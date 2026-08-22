import * as migration_20260822_110027_initial from './20260822_110027_initial';
import * as migration_20260822_112726_popular_order from './20260822_112726_popular_order';

export const migrations = [
  {
    up: migration_20260822_110027_initial.up,
    down: migration_20260822_110027_initial.down,
    name: '20260822_110027_initial',
  },
  {
    up: migration_20260822_112726_popular_order.up,
    down: migration_20260822_112726_popular_order.down,
    name: '20260822_112726_popular_order'
  },
];
