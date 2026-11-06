# Requirement file storage on AWS S3

The requirement form accepts multiple Word (`.doc`, `.docx`) and PDF files up to 50 MB each. Files are stored in a private S3 bucket; the app stores an `s3://` key in `requirement_documents`. Supabase Edge Function `requirement-files` issues short-lived upload and download URLs after checking the signed-in user's `dev` or `pm` role and the requirement's access. AWS credentials must never be added to the browser app.

Existing files stored in the private Supabase Storage bucket keep working. New file uploads use S3.

## AWS setup

1. Create a bucket in the AWS region you'll use for the function. Keep **Block all public access** enabled and enable default server-side encryption.
2. Configure bucket CORS for the deployed app's exact origin(s), plus local development if needed:

   ```json
   [
     {
       "AllowedOrigins": ["https://your-app.example.com", "http://localhost:3000"],
       "AllowedMethods": ["POST"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3000
     }
   ]
   ```

3. Create an IAM identity for the Edge Function with only these object permissions. Replace the bucket name:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
         "Resource": "arn:aws:s3:::YOUR_BUCKET/requerimientos/*"
       }
     ]
   }
   ```

   Create an access key for that identity. Do not grant public access or `s3:ListBucket`.

## Supabase setup

Link the Supabase CLI to the existing project, then save the AWS values as function secrets:

```sh
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set AWS_REGION=YOUR_AWS_REGION AWS_S3_BUCKET=YOUR_BUCKET AWS_ACCESS_KEY_ID=YOUR_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY=YOUR_SECRET_ACCESS_KEY
supabase functions deploy requirement-files
```

If using temporary AWS credentials, set `AWS_SESSION_TOKEN` as a secret as well. The Edge Function also needs the standard `SUPABASE_URL` and `SUPABASE_ANON_KEY` environment values supplied by Supabase. It does not need the Supabase service-role key.

The app's frontend origin must be listed in S3 CORS. The bucket remains private; only five-minute signed URLs are returned. The function limits uploads to Word/PDF MIME types and 50 MB, and verifies the caller's profile and requirement through the caller's Supabase session.

## Verification

After deployment, sign in with a `dev` or `pm` profile, create or edit a requirement, attach a Word or PDF file below **Detalle de cambios**, and save. Verify that:

- The file appears in the requirement's documents.
- Opening it works while signed in.
- A non-`dev`/`pm` user cannot upload, download, or delete through the function.
- An oversized file or an unsupported extension is rejected.
