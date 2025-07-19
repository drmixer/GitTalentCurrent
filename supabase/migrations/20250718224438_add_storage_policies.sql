-- Create policy for profile-pics bucket
INSERT INTO storage.policies (bucket_id, name, policy)
VALUES ('profile-pics', 'Allow authenticated users to upload to their own folder',
$$
  CREATE POLICY "Allow authenticated users to upload to their own folder"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-pics' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
$$);

INSERT INTO storage.policies (bucket_id, name, policy)
VALUES ('profile-pics', 'Allow anyone to view files',
$$
  CREATE POLICY "Allow anyone to view files"
  FOR SELECT
  TO public
  USING (
    bucket_id = 'profile-pics'
  );
$$);

-- Create policy for company-logos bucket
INSERT INTO storage.policies (bucket_id, name, policy)
VALUES ('company-logos', 'Allow authenticated users to upload to their own folder',
$$
  CREATE POLICY "Allow authenticated users to upload to their own folder"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'company-logos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
$$);

INSERT INTO storage.policies (bucket_id, name, policy)
VALUES ('company-logos', 'Allow anyone to view files',
$$
  CREATE POLICY "Allow anyone to view files"
  FOR SELECT
  TO public
  USING (
    bucket_id = 'company-logos'
  );
$$);
