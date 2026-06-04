# Authentication

- **Bot**: Identified via the WhatsApp Phone Number.
- **Web**: Web uses NextAuth. User enters phone number on `/login`. Next API calls Supabase edge function `auth/` to generate and text an OTP. User enters OTP on Web. Web validates via another Next API route. If valid, issues a JWT representing the user.
