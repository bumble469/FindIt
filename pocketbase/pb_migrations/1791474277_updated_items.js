/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_710432678")

  // add field
  collection.fields.addAt(12, new Field({
    "help": "",
    "hidden": false,
    "id": "select3205128242",
    "maxSelect": 0,
    "name": "deposit_type",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "SELF",
      "OFFICE"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_710432678")

  // remove field
  collection.fields.removeById("select3205128242")

  return app.save(collection)
})
