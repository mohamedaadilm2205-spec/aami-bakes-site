# Aami Bakes website

This folder contains the customer storefront, private admin dashboard, Supabase migrations, and setup instructions. The customer page is `/`; the admin sign-in and dashboard are `/owner`.

## What is already set up

- The Supabase database migration was applied, and its 24 product rows were confirmed.
- The public menu read policy was split so anonymous visitors can read only active products without needing the private owner-check function. This fixed the permission error shown by the first local preview.
- The owner's Supabase user was created and granted the `owner` role. Sign in to the local dashboard at `http://localhost:3000/owner` with that account.
- The public-read `cake-photos` storage bucket exists. Only an authenticated owner can upload, replace, or delete photos; JPEG, PNG, and WebP are allowed up to 5 MB.
- Product prices are base making charges for 1 kg. Delivery and customization charges are separately confirmed by the owner. Phone and WhatsApp are configured for +91 94866 60973. Business address, Maps link, FSSAI registration, Instagram, and the illustrative photo links are in `src/lib/business.ts`.
- Node.js v24.21.0 and the app packages are installed. `Start Aami Bakes.bat` handles the local Node path for this computer.

## Preview on this computer

1. Make a copy of `.env.example` in this folder and name the copy `.env.local`.
2. Open `.env.local` in Notepad. The Supabase project URL is already filled in. In Supabase, open **Project Settings → API Keys** and copy the **publishable** key (starts with `sb_publishable_`) into `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Save the file and double-click **Start Aami Bakes.bat**. Keep the opened window running.
4. In your browser, open **http://localhost:3000** for the customer shop. Your mother’s sign-in page is **http://localhost:3000/owner**.

Never put a secret/service-role key into `.env.local` or website code. If the publishable key is missing, the site will show a connection message.

## Set up the owner sign-in

1. In Supabase, open **Authentication → Users → Add user**. Enter the admin’s email and set a password. Keep the password private.
2. Copy the new user’s ID shown in the user details.
3. Open **SQL Editor → New query** and run this after replacing the placeholder with the copied ID:

   ```sql
   insert into public.user_roles (user_id, role)
   values ('PASTE-OWNER-USER-ID-HERE', 'owner');
   ```

4. The admin can sign in at `/owner`. She can review website enquiries, confirm charges, change order status, search old orders, and manage products and photos.

## Customer enquiries and order records

Customers do not need an account or OTP. The first tap on a cake adds 1 kg; further taps and basket controls change the amount by 0.5 kg. A basket bar stays visible while browsing. The menu says “Starting from” because customizations and delivery are priced separately. When a customer submits the enquiry, the site saves it in Supabase first and then opens WhatsApp with the same order number. It appears immediately in the Admin queue as **New**. Your mother calls the customer to verify the details, agrees the final delivery/customization charges, and updates the order.

The Admin workspace stores delivery/customization charges, moves enquiries through preparation to completion, and keeps completed orders in history. The customer can see the reference in WhatsApp and the on-page confirmation; private order history remains Admin-only. The Supabase Phone provider can stay turned off, so no customer SMS/OTP cost is needed.

## Publish the site online

This project is configured as a static export. `npm run build` creates the upload-ready `out` folder. The long-term workflow is to put the source folder in a GitHub repository (keep `.env.local` out of GitHub), connect that repository in Netlify, set build command `npm run build`, and publish directory `out`. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Netlify’s environment settings so they are present when Netlify builds. Never add a Supabase secret/service-role key to the website or repository. Netlify can provide a free `netlify.app` address. Free hosting plans have usage limits and can change; see current provider pricing before relying on them for business operations.

The Supabase Free plan has usage limits, no automatic database backups, and can pause a project after a week of low activity. Keep a periodic export of important orders. Product photos uploaded by the Admin are stored in the Supabase `cake-photos` bucket. Until real cake photos are uploaded, the shop uses Unsplash cake photos as illustrative inspiration; it labels them so customers know a finished custom cake may differ.

The auto-save migration `supabase/migrations/0003_save_public_whatsapp_enquiries.sql` has been applied to the configured Supabase project. For a fresh project, run it in SQL Editor after applying migrations 0001 and 0002. The public website calls one validated function to save a new enquiry (name, phone, address, payment preference, customization request, and cake selections). Cake prices and totals are calculated from the product table. Customers cannot read order rows; the authorized Admin account can. Website enquiries are saved as **New** and are not verified bookings until the Admin calls the customer.

Before launch, confirm the menu spelling “Muttaimittai” and replace the illustrative cake photos with approved product photos from **Admin → Products & pricing**. Update contact information in `src/lib/business.ts` if the business details change.

### Where to change photos

- **Menu cake photos:** Sign in at `/owner`, open **Products & pricing**, choose a cake, and use its photo control to upload or replace its image.
- **Bakery logo:** The logo appears in the top navigation and footer. Its transparent image file is `public/aami-bakes-logo.png`.
- **Large top/hero photo:** The photo file is `public/aami-bakes-hero-cake.jpeg`; the `cakePhotos[0]` entry in `src/lib/business.ts` points to it. The storefront fills the frame with a softly blurred extension behind the full photo.
- **Three inspiration photos:** These are the next three entries in the `cakePhotos` list in `src/lib/business.ts`, pointing to the three gallery images in `public/`. These four site-wide images do not yet have controls in the Admin dashboard. If you want different ones, send the photos and they can be added for you.




## Google reviews and FSSAI mark

The storefront links visitors to the complete Google Maps review listing rather than copying review text into the site. Google Places API returns at most five reviews per place and requires author attribution and direct source links; displaying live Google reviews would need additional API setup. The contact card uses a simple shield icon beside the FSSAI license number, not the official FSSAI logo. FSSAI's published guidance says use of its logo on websites is considered case by case and requires permission.

