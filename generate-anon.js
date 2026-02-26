const jwt = require('jsonwebtoken');

const JWT_SECRET = 'c+hxaCbDPaDEw3Qw1m4BiFu6aajTR7lw3LfpruNdmXKKry5mXMbv2zpTJj+xj0Ehqh7RIacTDhKXRxnOYtevIQ==';
const PROJECT_REF = 'kxgrwkzxskdfdsnlxofs';

// Exact iat and exp from the service role key
const IAT = 1771244230;
const EXP = 2086820230;

const payload = {
    iss: 'supabase',
    ref: PROJECT_REF,
    role: 'anon',
    iat: IAT,
    exp: EXP
};

const anonKey = jwt.sign(payload, JWT_SECRET);
console.log('--- Generated Anon Key ---');
console.log(anonKey);
console.log('--------------------------');
