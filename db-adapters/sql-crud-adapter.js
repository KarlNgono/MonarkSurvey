function SqlCrudAdapter(queryExecutorFunction) {
  function getObjects(tableName, filter, callback) {
    filter = filter || [];
    const values = [];
    let where = "";

    if (filter.length > 0) {
      const conds = filter.map((fi, i) => {
        values.push(fi.value);
        return `${fi.name} ${fi.op} $${i + 1}`;
      });
      where = " WHERE " + conds.join(" AND ");
    }

    const command = `SELECT * FROM ${tableName}${where}`;
    queryExecutorFunction(command, values, (error, results) => {
      if (error) throw error;
      callback(results.rows);
    });
  }

  function deleteObject(tableName, idValue, callback) {
    const command = `DELETE FROM ${tableName} WHERE id=$1`;
    queryExecutorFunction(command, [idValue], (error, results) => {
      if (error) throw error;
      callback(results);
    });
  }

  function createObject(tableName, object, callback) {
    const keys = Object.keys(object);
    const values = Object.values(object);
    const placeholders = keys.map((_, i) => `$${i + 1}`);

    const command = `INSERT INTO ${tableName} (${keys.join(",")}) VALUES (${placeholders.join(",")}) RETURNING id`;
    queryExecutorFunction(command, values, (error, results) => {
      if (error) throw error;
      callback(results.rows[0].id);
    });
  }

  function updateObject(tableName, object, callback) {
    const keys = Object.keys(object).filter(k => k !== "id");
    const values = keys.map(k => object[k]);
    const setString = keys.map((k, i) => `${k}=$${i + 1}`).join(", ");
    values.push(object.id);

    const command = `UPDATE ${tableName} SET ${setString} WHERE id=$${keys.length + 1}`;
    queryExecutorFunction(command, values, (error) => {
      if (error) throw error;
      callback(object);
    });
  }

  return {
    create: createObject,
    retrieve: getObjects,
    update: updateObject,
    delete: deleteObject
  };
}

module.exports = SqlCrudAdapter;
