/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_710432678")

  // update collection data
  unmarshal({
    "updateRule": "reported_by = @request.auth.id ||\n(\n  @request.auth.id != \"\" &&\n  type = \"FOUND\" &&\n  status = \"OPEN\" &&\n  @request.body.status = \"CLAIMED\" &&\n  @request.body.claimed_by = @request.auth.id &&\n  @request.body.item_name:isset = false &&\n  @request.body.description:isset = false &&\n  @request.body.category:isset = false &&\n  @request.body.location:isset = false &&\n  @request.body.datetime:isset = false &&\n  @request.body.image:isset = false &&\n  @request.body.item_specs:isset = false &&\n  @request.body.custody:isset = false &&\n  @request.body.type:isset = false &&\n  @request.body.reported_by:isset = false\n)"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_710432678")

  // update collection data
  unmarshal({
    "updateRule": "reported_by = @request.auth.id"
  }, collection)

  return app.save(collection)
})
