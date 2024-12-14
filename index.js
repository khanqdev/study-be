const PORT = 3000;
const express = require('express');
const PG = require("pg");
const app = express();
const bodyParser = require("body-parser");
var jwt = require('jsonwebtoken');

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
    const validToken = await checkValidToken(req, res);
    if (!validToken) return;
    const { tableName, columns } = req.body;
    const columnQuery = columns.map(({key, type}) => `${key} ${type}`).join(", ");
    var sql = `CREATE TABLE IF NOT EXISTS ${tableName} (id SERIAL PRIMARY KEY, ${columnQuery})`;
    const queryRes = await queryDB(sql);
    if (queryRes.error) {
        res.status(400).json(queryRes)
    } else {
        res.status(201).json({ 
            status: 201, 
            message: `Table ${tableName} has been created`
        })
        res.end();
    }
})

// Get list records by table name
app.get('/:table', async (req, res) => {
    const validToken = await checkValidToken(req, res);
    if (!validToken) return;
    var sql = `SELECT * FROM ${req.params.table}`;
    const queryRes = await queryDB(sql);

    if (queryRes.error) {
        res.status(400).json(queryRes)
    } else {
        res.status(200).json(queryRes)
        res.end()
    }
})

// Get record by id in table name
app.get('/:table/:id', async (req, res) => {
    const validToken = await checkValidToken(req, res);
    if (!validToken) return;
    var sql = `SELECT * FROM ${req.params.table} WHERE id = ${req.params.id} LIMIT 1`;
    const queryRes = await queryDB(sql);

    if (queryRes.error) {
        res.status(400).json(queryRes)
    } else {
        res.status(200).json(queryRes.data[0])
        res.end();
    }
})

// Insert record into table
app.post('/:table', async (req, res) => {
    const validToken = await checkValidToken(req, res);
    if (!validToken) return;
    const keys = Object.keys(req.body);
    const values = Object.values(req.body);
    const placeholders = keys.map((_, idx) => `$${idx + 1}`).join(", ");
    const sql = `INSERT INTO ${req.params.table} (${keys.join(", ")}) VALUES (${placeholders})`;
    const queryRes = await queryDB(sql, values);

    if (queryRes.error) {
        res.status(400).json(queryRes)
    } else {
        res.status(201).json({message: 'New record added successfully'})
    }
    res.end()
})

// Update record by table name & id
app.put('/:table/:id', async (req, res) => {
    const validToken = await checkValidToken(req, res);

    if (!validToken || !req.body) return;
    const isExisting = await client.query(`SELECT 1 FROM ${req.params.table} WHERE id = $1`, [req.params.id]);

    if (isExisting.rowCount > 0) {
        const setClauses = Object.keys(req.body)
            .map((key, index) => `${key} = $${index + 1}`)
            .join(", ");
        const updateQuery = `UPDATE ${req.params.table} SET ${setClauses} WHERE id = ${req.params.id};`;
        const queryRes = await queryDB(updateQuery, Object.values(req.body));

        if (queryRes.error) {
            res.json(queryRes).end();
            return;
        }
        res.status(201).json({status: 200, message: 'The record has been updated'});
        res.end();
    } else {
        res.status(400).json({status: 400, error: 'Not match any record'})
        res.end();
    }
})

queryDB = async (sql, values = []) => {
    try {    
        const result = await client.query(sql, values);
        return { data: result?.rows, total: result?.rowCount }
    } catch (error) {
        switch (error.code) {
            case '3D000': // Database không tồn tại
                return { message: 'Database does not exist', code: error.code }
            case '42P01': // Bảng không tồn tại
                return { message: 'Record does not exist', code: error.code }
            case '28000': // Authentication Failed
                return { message: 'Authentication Failed', code: error.code }
            case '42P07': // Bảng đã tồn tại
                return { message: 'Table already exists', code: error.code }
            case 'ECONNREFUSED': // Không thể kết nối
                return { message: 'Something went wrong', code: error.code }
            default:
                return error
        }
    }
}

checkValidToken = async(req, res) => {
    if (!req.headers.token) {
        res.status(401).json({
            status: 401,
            message: 'Your token has been expired'
        })
        return false
    }
    const {exp} = jwt.decode(req.headers.token);

    return new Date().valueOf() >= exp
}

// ----------------------------------------------------------------

// Login
app.post('/users/create-token', async (req, res) => {
    const sql = `SELECT * FROM users WHERE username = $1`;
    const queryRes = await queryDB(sql, [req.body.username]);
    if (queryRes.error) {
        res.status(400).json({status: 400, message: 'User is not exist'})
    } else {
        const token = jwt.sign(req.body, process.env.PRIVATE_KEY, {
            expiresIn: '30m'
        });
        const rfToken = jwt.sign(req.body, process.env.REFRESH_TOKEN_SECRET, {
            expiresIn: '1d'
        });
        res.cookie('rftoken', rfToken, {
            maxAge: 30 * 60 * 24 * 1000, // 1day
            // httpOnly: true,
            sameSite: 'none',
            // secure: true
        })
        res.status(201).json({status: 201, data: {...queryRes.data[0], token}})
    }
    res.end();
});
app.post('/users/register', async (req, res) => {
    const selectSql = `SELECT * FROM users WHERE username = '${req.body.username}'`;
    const selectQuery = await queryDB(selectSql, []);
    if (selectQuery.data.length){
        res.status(400).json({code: 400, message: 'User already used'}).end();
        return;
    } else if (selectQuery.error) {
        res.status(400).json(selectQuery).end();
        return;
    }
    const keys = Object.keys(req.body);
    const values = Object.values(req.body);
    const placeholders = keys.map((_, idx) => `$${idx + 1}`).join(", ");
    const sql = `INSERT INTO users (${keys.join(", ")}) VALUES (${placeholders})`;
    const queryRes = await queryDB(sql, values);
    console.log(queryRes);
    if (queryRes.error) {
        res.status(400).json(queryRes)
    } else {
        res.status(201).json({status: 200, data: 'User has been created'})
    }
    res.end();
});

app.listen(PORT, function () {
    console.log('Node server running on port ' + PORT)
});