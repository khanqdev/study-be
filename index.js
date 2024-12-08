const PORT = 3000;
const express = require('express');
const PG = require("pg");
const app = express();
const bodyParser = require("body-parser");

const client = new PG.Client({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.PG_PORT,
    database: process.env.DB
})
client.connect();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


// Create a table with name and columns
app.post('/createTable' , async (req, res) =>{
    const { tableName, columns } = req.body;
    const columnQuery = columns.map(c => {
        return `${c.key} ${c.type}`
    }).join(', ')
    var sql = `CREATE TABLE ${tableName} (${columnQuery})`;
    const queryRes = await queryDB(sql);
    
    if (queryRes.error) {
        res.send({
            status: queryRes.code,
            message: queryRes.error
        })
    } else {
        res.send({ 
            status: 201, 
            message: `Table ${tableName} has been created`
        })
    }
    res.end();
})

// Get list records by table name
app.get('/:table', async (req, res) => {
    var sql = `SELECT * FROM ${req.params.table}`;
    const queryRes = await queryDB(sql);

    if (queryRes.error) {
        res.send({
            status: queryRes.code,
            message: queryRes.error
        })
    } else {
        res.send(queryRes)
    }
    res.end()
})

// Get record by id in table name
app.get('/:table/:id', async (req, res) => {
    var sql = `SELECT * FROM ${req.params.table} WHERE id = ${req.params.id}`;
    const queryRes = await queryDB(sql);

    if (queryRes.error) {
        res.send({
            status: queryRes.code,
            message: queryRes.error
        })
    } else {
        res.send(queryRes)
    }
    res.end()
})

// Insert record into table
app.post('/:table', async (req, res) => {
    console.log(req.body)
    const keys = Object.keys(req.body);
    const values = Object.values(req.body);
    const placeholders = keys.map((_, idx) => `$${idx + 1}`).join(", ");
    const sql = `INSERT INTO ${req.params.table} (${keys.join(", ")}) VALUES (${placeholders})`;
    const queryRes = await queryDB(sql, values);

    if (queryRes.error) {
        res.send({
            status: queryRes.code,
            message: queryRes.error
        })
    } else {
        res.send({message: 'New record added successfully'})
    }
    res.end()
})

// Update record by table name & id
// app.put('/:table/:id', function (req, res) {
//     console.log(req.body)
//     const sql = `SELECT * FROM ${req.params.table} WHERE id = ${req.params.id}`;
//     const queryRes = queryDB(sql);
//     console.log("========", queryRes)
//     const body = req.body;
//     if (queryRes.error) {
//         res.send({status: 400, error: queryRes.error})
//         res.end();
//         return;
//     }
// })

async function queryDB(sql, values = []) {
    try {    
        const result = await client.query(sql, values);
        console.log('989898989898989',result)
        return { data: result?.rows, total: result?.rowCount }
    } catch (error) {
        switch (error.code) {
            case '3D000': // Database không tồn tại
                return { error: 'Database does not exist', code: error.code }
            case '42P01': // Bảng không tồn tại
                return { error: 'Record does not exist', code: error.code }
            case '28000': // Authentication Failed
                return { error: 'Authentication Failed', code: error.code }
            case '42P07': // Bảng đã tồn tại
                return { error: 'Table already exists', code: error.code }
            case 'ECONNREFUSED': // Không thể kết nối
                return { error: 'Something went wrong', code: error.code }
            default:
                return { error: error.message, code: error.code }
        }
    }
}

app.listen(PORT, function () {
    console.log('Node server running on port ' + PORT)
});