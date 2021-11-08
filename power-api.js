const express = require('express');
const MongoClient = require('mongodb').MongoClient;
const xml2js = require('xml2js');
var cors = require('cors')
const axios = require('axios');

const WebSocket = require('ws');
const webSocketPort = 4000;
const ws = new WebSocket.Server({ port: webSocketPort });

const app = express();
app.use(cors());

const mongoUrl = 'mongodb://127.0.0.1:27017';
const port = 3000;

const powerPort = 8080;
const powerUrl = 'http://127.0.0.1:' + powerPort;

var devices = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                        <devices>
                            <id>MDB1-2</id>
                            <id>MDB1</id>
                            <id>MDB2</id>
                            <id>Solar3</id>
                            <id>Sol3</id>
                        </devices>`;

var devicesId = ['MDB1-2', 'MDB1', 'MDB2', 'Solar3', 'Sol3'];

/*
    1. get devices list then use gotten id to get value from .../variableValue every 3 seconds (export value to web socket)
    2. keep history (from 1.) every 1 minute (1 value/minute)
    3. get history (by filtered)
        - today (00.00 - now) -> 5 mins/15 mins/1 hour/raw (get all values eg. 5mins -> return 5 values, 1 hour -> return 60 values)
        - yesterday (00.00 - 23.59 of yesterday) -> 5 mins/15 mins/1 hour/raw
        - this week -> 1 day/5 mins/15 mins/1 hour/raw
        - this month -> 1 day/1 week/5 mins/15 mins/1 hour/raw
        - specific time (DateTime - DateTime) -> 5 mins/15 mins/1 hour/raw
*/


var insertObjToDatabase = (obj) => {
    MongoClient.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true },
        function(err, db) {
            if (err) throw err;
            var dbo = db.db("power-api");
            dbo.collection(`${obj.id}`).insertOne(obj, function(err, res) {
                if (err) throw err;
            });
        }
    );
}

// async function findObjInDatabase (queryObj) {
//     await MongoClient.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true },
//         function(err, db) {
//             if (err) throw err;
//             var dbo = db.db("power-api");
//             dbo.collection("information").find(queryObj).toArray((err, docs) => {
//                 if (err) throw err;
//                 console.log(docs)
//                 return(docs);
//             });
//         }
//     );
// }

var insertMockedUpData = async () => {
    // var id = devicesId[Math.floor(Math.random() * devicesId.length)];
    try {
        var responseList = [];
        for(var i = 0; i < devicesId.length; i++) {
            var response = await axios.post(`http://localhost:3000/devices/${devicesId[i]}`);
            responseList.push(response.data);
        }
        console.log(responseList);
        responseList = [];
        // const response = await axios.post(`http://localhost:3000/devices/${id}`);
        // console.log(response.data);
    } catch (error) {
        console.error(error);
    }
}

setInterval(() => {
    insertMockedUpData();
}, 60000);

var insertMockedUpData = async () => {
    // var id = devicesId[Math.floor(Math.random() * devicesId.length)];
    try {
        var responseList = [];
        for(var i = 0; i < devicesId.length; i++) {
            var response = await axios.post(`http://localhost:3000/devices/${devicesId[i]}`);
            responseList.push(response.data);
        }
        console.log(responseList);
        responseList = [];
        // const response = await axios.post(`http://localhost:3000/devices/${id}`);
        // console.log(response.data);
    } catch (error) {
        console.error(error);
    }
}

// var isValidDate = (dateString) => {
//     if (dateString === undefined) {
//         return false;
//     }
//     var regEx = /^\d{4}-\d{2}-\d{2}$/;
//     // var regEx = /\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)/
//     if(!dateString.match(regEx)) return false;  // Invalid format
//     var d = new Date(dateString);
//     var dNum = d.getTime();
//     if(!dNum && dNum !== 0) return false; // NaN value, Invalid date
//     return d.toISOString().slice(0,10) === dateString;
//   }

var isValidDate = (dateString) => {
    const _regExp  = new RegExp('^(-?(?:[1-9][0-9]*)?[0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(.[0-9]+)?(Z)?$');
    return _regExp.test(dateString);
}

var getFilterObject = (filterBy, [minDate, maxDate]) => {
    var date = new Date();
    var today = date.toISOString();
    today = today.substring(0, 10);

    var dateOfTomorrow = new Date();
    dateOfTomorrow.setDate(dateOfTomorrow.getDate() + 1);
    var tomorrow = dateOfTomorrow.toISOString();
    tomorrow = tomorrow.substring(0, 10);

    var dateOfYesterday = new Date();
    dateOfYesterday.setDate(dateOfYesterday.getDate() - 1);
    var yesterday = dateOfYesterday.toISOString();
    yesterday = yesterday.substring(0, 10);

    var isMinDateOrMaxDateIsUndefinded = minDate === undefined && maxDate === undefined

    console.log(`🍪 today = ${today}`);
    console.log(`🍪 yesterday = ${yesterday}`);
    console.log(`🍪 tomorrow = ${tomorrow}`);
    console.log(`🥠 minDate = ${minDate}`);
    console.log(`🥠 maxDate = ${maxDate}`);
    console.log(`🍿 isMinDateOrMaxDateIsUndefinded = ${isMinDateOrMaxDateIsUndefinded}`);

    if (filterBy === 'today') {
        return { created_on: { $gte: new Date(today), $lt: new Date(tomorrow) } };
    } else if (filterBy == 'yesterday') {
        return { created_on: { $gte: new Date(yesterday), $lt: new Date(today) } };
    } else if (filterBy == 'specific') {
        return !isMinDateOrMaxDateIsUndefinded ? { created_on: { $gte: new Date(minDate), $lte: new Date(maxDate) } }: { created_on: new Date('0001-01-01') };
    } else {
        return { created_on: new Date('0001-01-01') };
    }
}

//get devices list
app.get('/devices', cors(), (req, res) => {
    xml2js.parseString(devices, (err, result) => {
        if(err) {
            throw err;
        }
        const jsonString = JSON.stringify(result, null, 4);
        var json = JSON.parse(jsonString);
        res.send(json);
    });
});

//get newest data of device
app.get('/devices/:deviceId', cors(), (req, res) => {
    var deviceId = req.params.deviceId;
    var queryObj = { id: deviceId };

    MongoClient.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true },
        function(err, db) {
            if (err) throw err;
            var dbo = db.db("power-api");
            dbo.collection(`${deviceId}`).find(queryObj).sort({ _id: -1 }).limit(1).toArray((err, value) => {
                if (err) throw err;
                res.send(value[0]);
            });
        }
    );
});

//fetch data and write in database
app.post('/devices/:deviceId', cors(), (req, res) => {
    var deviceId = req.params.deviceId;

    var dataFromPowerStudio = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                    <values>
                        <variable>
                            <id>${deviceId}.DESCRIPTION</id>
                        </variable>
                        <variable>
                            <id>${deviceId}.NAME</id>
                            <textValue>${deviceId}</textValue>
                        </variable>
                        <variable>
                            <id>${deviceId}.PTIME</id>
                            <value>${Math.random() * 100000}</value>
                        </variable>
                        <variable>
                            <id>${deviceId}.STATUS</id>
                            <value>1.000000</value>
                        </variable>
                        <variable>
                            <id>${deviceId}.VDTTM</id>
                            <value>${Math.random() * 100000000000000}</value>
                        </variable>
                    </values>`

    xml2js.parseString(dataFromPowerStudio, (err, result) => {
        if(err) {
            throw err;
        }
        const jsonString = JSON.stringify(result, null, 4); //json string data from power studio
        var json = JSON.parse(jsonString); //json data from power studio
        const date = new Date().toISOString()
        const created_on = new Date(date);

        json = { id: deviceId, ...json, created_on };
        if (devicesId.includes(deviceId)) {
            insertObjToDatabase(json);
            // console.log(json.values.variable[1].textValue[0]); //deviceId
            // console.log(json.values.variable[4].value[0]); //value
            res.send(json);
        } else {
            res.status(400).send(`Not has this devices in the system.`);
        }
    });
});

app.get('/devices/:id/history/', (req, res) => {
    var acceptedFilter = ['today', 'yesterday', 'thisWeek', 'thisMonth', 'specific'];
    var acceptedInterval = ['5m', '15m', '1hr', '1d', 'raw'];

    var deviceId = req.params.id;

    var filterBy = req.query.filterBy;
    var interval = req.query.interval;

    var minDate = req.query.minDate
    var maxDate = req.query.maxDate

    var canFilter = acceptedFilter.includes(filterBy);
    var isFilterWithInterval = acceptedInterval.includes(interval);

    console.log(`minDate = ${minDate}`);
    console.log(`maxDate = ${maxDate}`);
    console.log(`isValidDateMinDate = ${isValidDate(minDate)}`);
    console.log(`isValidDateMaxDate = ${isValidDate(maxDate)}`);

    if (canFilter) {
        var filter = {};
        if (filterBy == 'specific' && (isValidDate(minDate) && isValidDate(maxDate))) {
            filter = getFilterObject(filterBy, [minDate, maxDate]);
        } else {
            filter = getFilterObject(filterBy, []);
        }
        console.log(filter)

        MongoClient.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true },
            function(err, db) {
                if (err) throw err;
                var dbo = db.db("power-api");
                dbo.collection(`${deviceId}`).find(filter).toArray((err, docs) => {
                    if (err) throw err;
                    res.send(docs)
                });
            }
        );
    } else {
        console.log(`can't filter.`);
        res.status(400).send(`Can't filter. (HTTP StatusCode == 400)`);
    }
});

//get all data of device
app.get('/devices/:id/all', async (req, res) => {
    var deviceId = req.params.id;
    var queryObj = { id: deviceId };
    try {
        MongoClient.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true },
            function(err, db) {
                if (err) throw err;
                var dbo = db.db("power-api");
                dbo.collection(`${deviceId}`).find(queryObj).toArray((err, docs) => {
                    if (err) throw err;
                    res.send(docs);
                });
            }
        );
    } catch (e) {
        console.log(e);
    }
});

app.post('/alarm/', cors(), (req, res) => {
    var deviceId = req.query.deviceId;
    var alarmType = req.query.alarmType;
    var alertTimeString = req.query.alertDateTime;
    var fixedTimeString = req.query.fixedDateTime;
    console.log(alertTimeString)
    console.log(fixedTimeString)
    
    const alertDateTimeString = new Date(alertTimeString).toISOString();
    alertDateTime = new Date(alertDateTimeString);
    const fixedDateTimeString = new Date(fixedTimeString).toISOString();
    fixedDateTime = new Date(fixedDateTimeString);
    
    var json = { id: deviceId, alarmType: alarmType, alertDateTime: alertDateTime, fixedDateTime: fixedDateTime }; //json data from power studio
    json = { ...json, description: 'เกิดรอยรั่วที่จุด A' };
    
    if (devicesId.includes(deviceId)) {
        MongoClient.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true },
            function(err, db) {
                if (err) throw err;
                var dbo = db.db("power-api");
                dbo.collection('alarm').insertOne(json, function(err, res) {
                    if (err) throw err;
                });
            }
        );
        res.send(json);
    } else {
        res.status(400).send(`Not has this devices in the system.`);
    }
    
});

app.get('/alarm/all', (req, res) => {
    MongoClient.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true },
        function(err, db) {
            if (err) throw err;
            var dbo = db.db("power-api");
            dbo.collection('alarm').find({}).toArray((err, docs) => {
                if (err) throw err;
                res.send(docs);
            });
        }
    );
});

app.get('/alarm/:deviceId', (req, res) => {
    var deviceId = req.params.deviceId;
    MongoClient.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true },
        function(err, db) {
            if (err) throw err;
            var dbo = db.db("power-api");
            dbo.collection('alarm').find({ id: deviceId }).toArray((err, docs) => {
                if (err) throw err;
                res.send(docs);
            });
        }
    );
});

app.get('/', (req, res) => {
    res.send('Power - API')
});

app.listen(port, () => {
    console.log(`Power API is listening on port ${port}.`);
});

//web socket
ws.on('connection', (ws) => {
    var dataFromPowerStudio = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                                <values>
                                    <variable>
                                        <id>MDB1.DESCRIPTION</id>
                                    </variable>
                                    <variable>
                                        <id>MDB1.NAME</id>
                                        <textValue>MDB1</textValue>
                                    </variable>
                                    <variable>
                                        <id>MDB1.PTIME</id>
                                        <value>${Math.random() * 100000}</value>
                                    </variable>
                                    <variable>
                                        <id>MDB1.STATUS</id>
                                        <value>1.000000</value>
                                    </variable>
                                    <variable>
                                        <id>MDB1.VDTTM</id>
                                        <value>${Math.random() * 100000000000000}</value>
                                    </variable>
                                </values>`
    ws.on('message', (deviceId) => {
        var dataFromPowerStudio = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                                <values>
                                    <variable>
                                        <id>${deviceId}.DESCRIPTION</id>
                                    </variable>
                                    <variable>
                                        <id>${deviceId}.NAME</id>
                                        <textValue>${deviceId}</textValue>
                                    </variable>
                                    <variable>
                                        <id>${deviceId}.PTIME</id>
                                        <value>${Math.random() * 100000}</value>
                                    </variable>
                                    <variable>
                                        <id>${deviceId}.STATUS</id>
                                        <value>1.000000</value>
                                    </variable>
                                    <variable>
                                        <id>${deviceId}.VDTTM</id>
                                        <value>${Math.random() * 100000000000000}</value>
                                    </variable>
                                </values>`

        xml2js.parseString(dataFromPowerStudio, (err, result) => {
            if(err) {
                throw err;
            }
            const jsonString = JSON.stringify(result, null, 4); //json string data from power studio
            var json = JSON.parse(jsonString); //json data from power studio

            if (devicesId.includes(deviceId)) {
                // console.log(json.values.variable[1].textValue[0]); //deviceId
                // console.log(json.values.variable[4].value[0]); //value
                ws.send(jsonString);
            } else {
                ws.send(`Not has this devices in the system.`);
            }
        });
    });
    ws.on('close', () => {
        console.log('Disconnected from client web socket.');
    });
    ws.send('Connect to Power WebSocket');
    
    setInterval(() => {
        xml2js.parseString(dataFromPowerStudio, (err, result) => {
            if(err) {
                throw err;
            }
            const jsonString = JSON.stringify(result, null, 4);
            var json = JSON.parse(jsonString);
            ws.send(jsonString);
        });
    }, 3000);
});
