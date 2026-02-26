const jwt = require('jsonwebtoken');

const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4Z3J3a3p4c2tkZmRzbmx4b2ZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTI0NDIzMCwiZXhwIjoyMDg2ODIwMjMwfQ.R1ifDdarj7eMm9ToR25SlQ49L4w0JxB3YlnO0DVEwFg';
const JWT_SECRET = 'c+hxaCbDPaDEw3Qw1m4BiFu6aajTR7lw3LfpruNdmXKKry5mXMbv2zpTJj+xj0Ehqh7RIacTDhKXRxnOYtevIQ==';

try {
    const decoded = jwt.verify(SERVICE_ROLE_KEY, JWT_SECRET);
    console.log('✅ Signature Verified!');
    console.log('Payload:', decoded);
} catch (err) {
    console.error('❌ Signature Verification Failed:', err.message);
}
