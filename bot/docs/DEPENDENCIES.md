# Bot Dependencies

## External Dependencies
- **`express`**: HTTP server framework used to create the webhook endpoints.
- **`@supabase/supabase-js`**: Client library to interact with the Supabase PostgreSQL database and edge functions.
- **`@nlpjs/nlp`**: Core natural language processing library used to train the bot to understand varied user inputs.
- **`compromise`**: A lightweight NLP library used for entity extraction and text normalization before feeding into NLP.js.
- **`axios`**: Promise-based HTTP client used to send outbound POST requests to the Meta WhatsApp Cloud API.
- **`jsonwebtoken`**: Used to mint JWT tokens representing the user's phone number to authenticate Supabase requests and enforce RLS policies.
- **`dotenv`**: Loads environment variables from a `.env` file into `process.env`.
