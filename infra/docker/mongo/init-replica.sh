#!/usr/bin/env bash
set -euo pipefail

echo "Initializing MongoDB Replica Set rs0..."
mongosh "mongodb://${MONGO_ROOT_USER}:${MONGO_ROOT_PASSWORD}@mongodb:27017/admin" --eval '
  try {
    const status = rs.status();
    print("Replica set already initialized: " + status.set);
  } catch (e) {
    rs.initiate({
      _id: "rs0",
      members: [{ _id: 0, host: "mongodb:27017" }]
    });
    print("Replica set rs0 initiated successfully.");
  }
'
