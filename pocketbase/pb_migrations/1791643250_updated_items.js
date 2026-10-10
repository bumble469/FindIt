/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_710432678")

  // update collection data
  unmarshal({
    "createRule": "@request.auth.id != \"\" && @request.body.reported_by = @request.auth.id",
    "deleteRule": " reported_by = @request.auth.id",
    "listRule": null,
    "updateRule": "reported_by = @request.auth.id",
    "viewRule": null
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_710432678")

  // update collection data
  unmarshal({
    "createRule": "id = @request.auth.id",
    "deleteRule": "id = @request.auth.id",
    "listRule": "",
    "updateRule": "id = @request.auth.id",
    "viewRule": ""
  }, collection)

  return app.save(collection)
})
