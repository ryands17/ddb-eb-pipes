import { Entity } from 'electrodb';
import { ulid } from 'ulid';

export const Person = new Entity({
  model: { entity: 'person', service: 'personService', version: '1' },
  attributes: {
    id: { type: 'string', required: true, default: () => ulid() },
    firstName: { type: 'string', required: true },
    lastName: { type: 'string', required: true },
    age: { type: 'number', required: true },
  },
  indexes: {
    getPersons: { pk: { field: 'id', composite: ['id'], casing: 'none' } },
  },
});
