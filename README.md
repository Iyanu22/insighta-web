# Insighta Web Portal

Web interface for the Insighta Labs+ platform.

## Live URL
https://insighta-web-sage.vercel.app

## Pages
- `/login` — GitHub OAuth login
- `/dashboard` — metrics overview
- `/profiles` — profiles list with filters and pagination
- `/profiles/:id` — profile detail view
- `/search` — natural language search
- `/account` — user account info

## Authentication
- HTTP-only cookies for token storage
- Tokens never accessible via JavaScript
- Auto token refresh on expiry