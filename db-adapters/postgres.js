require("dotenv").config();
const fs = require("fs");
const SqlCrudAdapter = require("./sql-crud-adapter");
const SurveyStorage = require("./survey-storage");
const { Pool } = require("pg");

const dbConfig = {
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT,
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  ssl: process.env.DATABASE_SSL === "true"
      ? { rejectUnauthorized: false }
      : false
};

const pool = new Pool(dbConfig);

function PostgresStorage() {
  async function dbQuery(query, params) {
    return pool.query(query, params);
  }

  const queryExecutorFunction = (...args) => {
    if (process.env.DATABASE_LOG) console.log(args[0], args[1]);
    return pool.query(...args);
  };

  const dbQueryAdapter = new SqlCrudAdapter(queryExecutorFunction);
  const surveyStorage = new SurveyStorage(dbQueryAdapter);

  surveyStorage.dbQuery = dbQuery;

  return surveyStorage;
}

module.exports = PostgresStorage;
