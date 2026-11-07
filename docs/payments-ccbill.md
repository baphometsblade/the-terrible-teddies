# CCBill gem shop

Stripe's rules ban explicit adult content, so gem purchases do not use Stripe
in production. The shop talks to one provider, chosen by `VITE_PAYMENT_PROVIDER`:

| Value | Shop |
| --- | --- |
| unset, blank, or `none` | "Gem shop opening soon". No card-payment button. |
| `ccbill` | CCBill FlexForms. This is the provider to go live with. |
| `stripe` | The existing Stripe Checkout path. It still works. Leave it off. |

Prices stay the server bundle table (USD cents) in
`supabase/functions/ccbill-checkout/index.ts`. The browser never sends a price.

## 1. Supabase secrets

Set these on project `wqdrbywcktxgytkyqcco` (Dashboard → Edge Functions → Secrets,
or the CLI). Do not put them in the frontend or in git.

```bash
supabase secrets set --project-ref wqdrbywcktxgytkyqcco \
  CCBILL_ACCOUNT_NUMBER=900000 \
  CCBILL_SUBACCOUNT=0000 \
  CCBILL_FLEXFORM_ID=your-flexform-id \
  CCBILL_SALT='your-salt' \
  CCBILL_WEBHOOK_IPS='64.38.212.0/24,64.38.215.0/24,64.38.240.0/24,64.38.241.0/24' \
  ALLOWED_ORIGIN='https://your-production-origin' \
  DENO_ENV=production
```

| Secret | Where it comes from |
| --- | --- |
| `CCBILL_ACCOUNT_NUMBER` | CCBill admin, main account number (digits). |
| `CCBILL_SUBACCOUNT` | Subaccount the FlexForm belongs to, usually 4 digits (`0000`). |
| `CCBILL_FLEXFORM_ID` | The FlexForm id in the form URL. |
| `CCBILL_SALT` | The encryption/digest salt. Merchant Support issues it, or you choose one (up to 32 characters) and give them the same value. It signs both the payment link and the webhook. |
| `CCBILL_WEBHOOK_IPS` | Optional. When set, posts from any other address are rejected. The value above is CCBill's published postback ranges: Ashburn `64.38.212.0/24`, Amsterdam `64.38.215.0/24`, Phoenix `64.38.240.0/24` and `64.38.241.0/24`. Leave it unset only while you are posting signed test events from your own machine. |
| `ALLOWED_ORIGIN` | The site origin allowed to call `ccbill-checkout`. |
| `DENO_ENV` | `production` turns off the localhost origins. |

Hosted functions already receive `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY`. The checkout reads the buyer's JWT with the anon
key and records the Starter Gem Pack hold with the service role. The webhook
credits gems with the service role only, through `fulfill_gem_purchase` and
`reverse_gem_purchase`.

`CCBILL_SALT` is not a card number and not an API password. There is no CCBill
refund API on these secrets. A second Starter Gem Pack is not credited; that
webhook answers 500 and names the transaction so you can refund it in the
CCBill admin.

## 2. Deploy the functions

`supabase/config.toml` sets `verify_jwt = false` for `ccbill-webhook` only.
CCBill does not send a Supabase JWT. `ccbill-checkout` keeps JWT verification:
the function also checks the bearer token itself.

```bash
supabase functions deploy ccbill-checkout --project-ref wqdrbywcktxgytkyqcco
supabase functions deploy ccbill-webhook --project-ref wqdrbywcktxgytkyqcco --no-verify-jwt
```

## 3. Webhook URL

In the CCBill admin, point Webhooks at:

```text
https://wqdrbywcktxgytkyqcco.supabase.co/functions/v1/ccbill-webhook
```

Enable these events and no others:

- `NewSaleSuccess` — credits the bundle, once, keyed on the CCBill transaction id
- `NewSaleFailure` — recorded as ignored; nothing is credited
- `Refund` — claws the gems back when the refund is for the full billed price
- `Chargeback` — claws the gems back
- `Void` — claws the gems back

A partial refund (a smaller amount than the price billed) does not take the
gems. A refund that arrives before the sale is acknowledged with HTTP 409 so
CCBill retries it. A second delivery of the same transaction id is a no-op.

The post must include `dynamicPricingValidationDigest` or `responseDigest`:

- approval, refund, chargeback, void: MD5 of `subscriptionId` + `1` + salt
- denial (`NewSaleFailure`): MD5 of `denialId` + `0` + salt

Custom fields `userId` and `bundleId` are sent on the payment link. CCBill
echoes them as `X-userId` and `X-bundleId`. The webhook also accepts the names
without the prefix. The amount credited is the server price, and only when
`billedInitialPrice` and currency `840` (or `USD`) match that bundle.

## 4. FlexForm

In the FlexForm editor:

1. Turn on dynamic pricing and clear the fixed price list, so the price on the
   link is the one that is charged.
2. Make the form single billing (non-recurring). Do not pass a recurring price.
   `initialPeriod` is `2`, CCBill's minimum, because the charge does not rebill.
3. Currency code `840` (USD). Prices below CCBill's default floor (often $2.95)
   have to be allowed on the account; the gem table includes $0.99.
4. Approval URL: `https://your-production-origin/?purchase=success`
   Denial URL: `https://your-production-origin/?purchase=cancelled`
5. Promote the form to live.

The payment link is:

```text
https://api.ccbill.com/wap-frontflex/flexforms/<CCBILL_FLEXFORM_ID>
  ?clientAccnum=<CCBILL_ACCOUNT_NUMBER>
  &clientSubacc=<CCBILL_SUBACCOUNT>
  &initialPrice=<dollars with two decimals>
  &initialPeriod=2
  &currencyCode=840
  &formDigest=<md5>
  &userId=<supabase user uuid>
  &bundleId=<bundle id>
```

`formDigest` is the hex MD5 of `initialPrice + initialPeriod + currencyCode + salt`
with nothing between the fields. CCBill's published example:

```text
initialPrice   10.00
initialPeriod  30
currencyCode   840
salt           qwertyasdfgzxcvbnhyujm
string         10.0030840qwertyasdfgzxcvbnhyujm
formDigest     931d2fa3cf0ed016780712901308bfad
```

This shop uses `initialPeriod` `2`, not `30`. The example is only the hash
recipe. The salt is never put on the link.

## 5. Open the shop

Set the frontend variable and rebuild. It is public; it only chooses the till.

```bash
VITE_PAYMENT_PROVIDER=ccbill
```

Unset, the shop stays on "Gem shop opening soon".

## 6. Test mode

In the CCBill admin, create a test-transaction user and run a payment with the
test card numbers published in CCBill's Test Transaction Guide. Confirm the
FlexForm shows the bundle price, not a price baked into the form.

CCBill's test posts are not a reason to turn the digest check off. A post
without a matching digest is rejected. To exercise crediting before a live
card, send a signed `NewSaleSuccess` yourself (replace the salt, user id, and
transaction id):

```bash
SUB=0913022401000012345
SALT='your-salt'
DIGEST=$(printf '%s' "${SUB}1${SALT}" | md5sum | awk '{print $1}')
USER=<supabase-user-uuid>

curl -sS -X POST \
  'https://wqdrbywcktxgytkyqcco.supabase.co/functions/v1/ccbill-webhook' \
  -H 'Content-Type: application/json' \
  -d "{\"eventType\":\"NewSaleSuccess\",\"subscriptionId\":\"${SUB}\",\"transactionId\":\"txn-test-1\",\"billedInitialPrice\":\"0.99\",\"billedCurrencyCode\":\"840\",\"X-userId\":\"${USER}\",\"X-bundleId\":\"gems_small\",\"dynamicPricingValidationDigest\":\"${DIGEST}\",\"timestamp\":\"2026-11-07 12:00:00\"}"
```

Expect `{"received":true,"outcome":"credited"}`. Send the same body again and
expect `"outcome":"duplicate"` and no second credit. Then void or refund that
transaction in the CCBill admin (or POST a `Refund` with `billedInitialPrice`
and `billedAmount` both `0.99`, the same subscription id, and the same
approval digest) and confirm the gems are taken back.

If `CCBILL_WEBHOOK_IPS` is set, that curl is rejected until you unset the
allowlist for the test or send it from an address inside the ranges. Put the
allowlist back before real traffic.

A live check, once the form is promoted: buy the smallest bundle with a real
card, confirm the return to `/?purchase=success`, the gems on the account, and
a `purchases` row whose `stripe_session_id` is the CCBill transaction id.
Refund it from the CCBill admin and confirm the gems come off, including as a
debt if they were already spent.
