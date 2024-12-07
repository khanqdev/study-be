const PORT = 3000;
const express = require('express');
const PG = require("pg");
const app = express();
const bodyParser = require("body-parser");

var pg_client = null;
const connectionString = "postgres://" + process.env.DB_USER + ":" + process.env.DB_PASSWORD + "@" + process.env.DB_HOST + ":" + process.env.PG_PORT + "/" + process.env.DB;
const pg = new PG.Pool({ connectionString });

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

pg.connect(function (err, client) {
    if (err) {
        //. DB not running on first boot
        console.error("fail to connect", err);
    } else {
        pg_client = client;
    }
});

// Get list folders
app.get('/', function (_, res) {
    var sql = "select * from doc_folders";
    handleQgQuery(sql, res)
})

// Get folder by id
app.get('/:id', function (req, res) {
    var sql = `select * from doc_folders where id = ${req.params.id}`;
    handleQgQuery(sql, res)
})

// Update folder
app.put('/:id', function (req, res) {
    console.log('_____', req.params.id)
    var sql = `update doc_folders
                set folder_name = ${req.body.folder_name}
                where id = ${req.params.id}`
    handleQgQuery(sql, res)
})

function handleQgQuery(sql, res) {
    var query = { text: sql, values: [] };
    pg_client.query(query, function (err, result) {
        if (err) {
            console.error(err)
            res.status(400);
            res.write(JSON.stringify({ status: false, error: err }, null, 2));
            res.end();
        } else {
            res.write(JSON.stringify({ status: true, result: result.rows }, null, 2));
            res.end();
        }
    })
}

app.listen(PORT, function () {
    console.log('Node server running on port ' + PORT)
});