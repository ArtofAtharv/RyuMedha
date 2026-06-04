# RLS Policies
Row Level Security is heavily used.
The function `get_profile_id_from_jwt()` reads the `sub` claim of the JWT (which contains the user's phone number), looks up the corresponding `profile_id`, and policies ensure rows can only be selected/inserted/updated if `profile_id` matches.
