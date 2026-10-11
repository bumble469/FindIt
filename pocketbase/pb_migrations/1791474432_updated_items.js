/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_710432678")

  // add field
  collection.fields.addAt(12, new Field({
    "help": "",
    "hidden": false,
    "id": "select1295078278",
    "maxSelect": 0,
    "name": "custody",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "WITH_FINDER",
      "AT_OFFICE"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_710432678")

  // remove field
  collection.fields.removeById("select1295078278")

  return app.save(collection)
})
