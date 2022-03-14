const keys = require('./keys');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors')

const app = express();
app.use(cors());
app.use(bodyParser.json());

const { Pool } = require('pg');
const {pgPassword} = require("./keys");

const pgClient = new Pool({
    user: keys.pgUser,
    host: keys.pgHost,
    password: keys.pgPassword,
    port: keys.pgPort
})

pgClient.on("error", () => console.log("Lost PG connection."));

pgClient.on("connect", client => {
    client
        .query("CREATE TABLE IF NOT EXISTS values (number INT)")
        .catch(e => console.log(e))
});

const redis = require('redis');

const redisClient = redis.createClient({
    host: keys.redisHost,
    port: keys.redisPort,
    retry_strategy: () => 1000
});

const redisPublisher = redisClient.duplicate(); // if client used for pub/sub, it can't do other things. Hence duplicate

app.get('/', (req, res) => {
    res.send("hi");
});

app.get('/values/all', async (req, res) => {
   const values = await pgClient.query("SELECT * FROM values");
   res.send(values.rows);
});

app.get('/values/current', async (req, res) => {
   redisClient.hgetall('values', (err, values) => {
       res.send(values);
   })
});

app.post('/values', async (req, res) => {
   const { index } = req.body;
   if (parseInt(index) > 40)
       return res.status(422).send("Index too high!");

   redisClient.hset('values', index, "Nothing yet");
   redisPublisher.publish('insert', index);
   pgClient.query(`INSERT INTO values(number) VALUES(${index})`);

   res.send({ success: 1 });
});

app.listen(5000, () => {
    console.log("Listening to port 5000.");
});
