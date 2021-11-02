const express = require('express');
const MongoClient = require('mongodb').MongoClient;
const xml2js = require('xml2js');
var cors = require('cors')
const axios = require('axios');

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

var getTimeStamp = () => {
    var today = new Date();
    var day = insertZero(today.getDate() + "");
    var month = (insertZero(today.getMonth() + 1) + "");
    var year = insertZero(today.getFullYear() + "");
    var hour = insertZero(today.getHours() + "");
    var minute = insertZero(today.getMinutes() + "");
    var second = insertZero(today.getSeconds() + "");

    return {
        day: day,
        month: month,
        year: year,
        hour: hour,
        minute: minute,
        second: second
    }
}

var insertZero = (time) => {
    if(time.length == 1) {
        time = "0" + time;
    }
    return time;
}

var isValidDate = (dateString) => {
    if (dateString === undefined) {
        return false;
    }
    var regEx = /^\d{4}-\d{2}-\d{2}$/;
    if(!dateString.match(regEx)) return false;  // Invalid format
    var d = new Date(dateString);
    var dNum = d.getTime();
    if(!dNum && dNum !== 0) return false; // NaN value, Invalid date
    return d.toISOString().slice(0,10) === dateString;
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

    if (!isMinDateOrMaxDateIsUndefinded) {
        var minDateString = minDate.substring(0, 10);
        var maxDateString = maxDate.substring(0, 10);
        console.log(maxDateString);
        console.log(minDateString);
    }

    if (filterBy === 'today') {
        return { created_on: { $gte: new Date(today), $lt: new Date(tomorrow) } };
    } else if (filterBy == 'yesterday') {
        return { created_on: { $gte: new Date(yesterday), $lt: new Date(today) } };
    } else if (filterBy == 'specific') {
        return !isMinDateOrMaxDateIsUndefinded ? { created_on: { $gte: new Date(minDateString), $lte: new Date(maxDateString) } }: { created_on: new Date('0001-01-01') };
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

app.get('/', (req, res) => {
    res.send('Power - API')
});

app.listen(port, () => {
    console.log(`Power API is listening on port ${port}.`);
});

// today (5mins) -> 288 records