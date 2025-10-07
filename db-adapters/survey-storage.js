let currentId = 1;

function SurveyStorage(dbQueryAdapter) {
  function addSurvey(name, callback) {
    const newObj = {
      name: name && name.trim() !== "" ? name : "New Survey " + currentId++,
      json: "{}"
    };
    dbQueryAdapter.create("surveys", newObj, id => {
      newObj.id = id;
      callback(newObj);
    });
  }

  function postResults(postId, json, callback) {
    const newObj = {
      postid: postId,
      json: JSON.stringify(json)
    };
    dbQueryAdapter.create("results", newObj, id => {
      newObj.id = id;
      callback(newObj);
    });
  }

  function getResults(postId, callback) {
    dbQueryAdapter.retrieve(
      "results",
      [{ name: "postid", op: "=", value: postId }],
      results => {
        const data = results.map(r => {
          try { return JSON.parse(r.json); }
          catch (e) { return r.json; }
        });
        callback({ id: postId, data });
      }
    );
  }

  return {
    addSurvey,
    getSurvey: (surveyId, callback) => {
      dbQueryAdapter.retrieve(
        "surveys",
        [{ name: "id", op: "=", value: surveyId }],
        results => { callback(results[0]); }
      );
    },
    storeSurvey: (id, _, json, callback) => {
      dbQueryAdapter.update("surveys", { id, json }, results => { callback(results); });
    },
    getSurveys: callback => {
      dbQueryAdapter.retrieve("surveys", [], results => { callback(results); });
    },
    deleteSurvey: (surveyId, callback) => {
      dbQueryAdapter.delete("surveys", surveyId, results => { callback(results); });
    },
    postResults,
    getResults,
    changeName: (id, name, callback) => {
      dbQueryAdapter.update("surveys", { id, name }, results => { callback(results); });
    }
  };
}

module.exports = SurveyStorage;
