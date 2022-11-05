
import yargs from 'yargs/yargs';

export const namedArguments = yargs(process.argv.slice(2)).options({
  jwt_key: { type: 'string', default: undefined },
  development: { type: 'boolean', default: false },
  nologs: { type: 'boolean',  default: false  },
  without_google: { type: 'boolean',  default: false  },
}).parseSync();