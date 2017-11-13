'use strict';

const AWS = require('aws-sdk');
const async = require('async');
const GoogleSpreadsheet = require('google-spreadsheet');
const alexaLogger = require('./logger');

const dynamodb = new AWS.DynamoDB();

const SheetFactory = {};
const doc = new GoogleSpreadsheet(process.env.SHEET_URL);
const param = {
    ReturnConsumedCapacity: "TOTAL",
    TableName: process.env.AWS_DYNAMODB_TABLE_NAME,
    Item: {}
}
let sheet;

SheetFactory.setAuth = (step) => {
    const token = JSON.parse(process.env.GOOGLE_ACCESS_TOKEN);
    const creds = {
        "type": token.type,
        "project_id": token.project_id,
        "private_key_id": token.private_key_id,
        "private_key": token.private_key,
        "client_email": token.client_email,
        "client_id": token.client_id,
        "auth_uri": token.auth_uri,
        "token_uri": token.token_uri,
        "auth_provider_x509_cert_url": token.auth_provider_x509_cert_url,
        "client_x509_cert_url": token.client_x509_cert_url
    }
    doc.useServiceAccountAuth(creds, step);
};

SheetFactory.getInfoAndWorksheets = (step) => {
    doc.getInfo(function (err, info) {
        alexaLogger.logInfo('Loaded doc: ' + info.title + ' by ' + info.author.email);
        sheet = info.worksheets[0];
        alexaLogger.logInfo('sheet 1: ' + sheet.title + ' ' + sheet.rowCount + 'x' + sheet.colCount);
        step();
    });
};

SheetFactory.saveSheetData = (step) => {
    sheet.getRows({
        offset: 1
    }, function (err, rows) {
        async.eachSeries(rows, (row, callback) => {
            param.Item = {
                'alexa-id': {
                    S: row['alexa-id']
                },
                'answer': {
                    S: row.answer
                },
                'cardTitle': {
                    S: row['cardtitle']
                }
            }
            dynamodb.putItem(param, (err, data) => {
                if (err) {
                    alexaLogger.logError(`Error in putting data into dynamodb: ${err}`);
                    callback(err);
                }
                alexaLogger.logInfo(`Inserted data with id ${row['alexa-id']}`);
                param.Item = {};
                callback();
            });
        }, (asyncerr) => {
            if (asyncerr) {
                alexaLogger.logError(`Error in putting data into dynamodb: ${asyncerr}`);
                return step();
            }
            return step();
        });
    });
};

module.exports = SheetFactory;