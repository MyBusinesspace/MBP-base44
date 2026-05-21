import { generateFullSchemaSQL, entityToTable, loadEntitySchemas } from './schemaGenerator.js';

let _cache = null;

export function getEntityRegistry() {
  if (!_cache) {
    const { meta, schemas } = generateFullSchemaSQL();
    _cache = { meta, schemas };
  }
  return _cache;
}

export function getTableName(entityName) {
  const { meta } = getEntityRegistry();
  if (!meta[entityName]) return null;
  return meta[entityName].table;
}

export function getEntityPropertyNames(entityName) {
  const { schemas } = getEntityRegistry();
  return Object.keys(schemas[entityName]?.properties || {});
}

export { entityToTable, loadEntitySchemas };
