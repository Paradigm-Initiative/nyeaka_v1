import type { ServiceErrorCode } from "./errors";

/**
 * Services still throw English sentences (the tests assert on them). This table
 * maps each one to a translation key in the `errors` namespace so the UI never
 * shows raw English. New service errors should be added here, or, better,
 * switched to throw a key directly.
 */
export const BY_MESSAGE: Record<string, string> = {
  "Your account is restricted while we review reports about it, so you can't post or send offers right now.": "restricted",
  "You can't block yourself.": "blockSelf",
  "You can only block someone you have been matched with or exchanged an offer with.": "blockNotMatched",
  "Listing not found": "listingNotFound",
  "Request not found": "requestNotFound",
  "You can't report yourself.": "reportSelf",
  "You can only report someone you have been matched with or exchanged an offer with.": "reportNotMatched",
  "You've already reported this person. We're reviewing it.": "alreadyReported",
  "Conversation not found": "conversationNotFound",
  "You are not part of this conversation": "notInConversation",
  "This match was cancelled, so the chat is closed.": "chatClosed",
  "You can't send messages in this conversation.": "cannotSend",
  "Match not found": "matchNotFound",
  "You are not part of this match": "notInMatch",
  "You've already rated this match.": "alreadyRated",
  "Ratings aren't available for this match.": "ratingUnavailable",
  "You can rate once the handoff is confirmed or the match ends.": "rateAfterHandoff",
  "Ratings open after a cancelled match only if you both exchanged messages.": "ratingNeedsMessages",
  "The rating window for this match has closed.": "ratingWindowClosed",
  "You can't offer on your own post.": "offerOwnPost",
  "You can only offer with your own listing or request.": "offerOwnOnly",
  "You can't send an offer to this person.": "offerBlocked",
  "You already have an active offer on this request.": "alreadyOffered",
  "This device was already offered on this request.": "deviceAlreadyOffered",
  "Offer not found": "offerNotFound",
  "You can only withdraw offers you sent.": "withdrawOwnOnly",
  "This offer has already been answered.": "offerAnswered",
  "You can't do that in this conversation.": "handoffForbidden",
  "This match was cancelled, so numbers can't be shared.": "numbersCancelled",
  "Add your phone number to share it.": "addPhone",
  "This match was cancelled, so there is nothing to confirm.": "nothingToConfirm",
  "Photos must be uploaded through Nyeaka": "photosViaNyeaka",
  "Only the person who received this offer can answer it.": "onlyRecipientAnswers",
  "This offer is no longer available.": "offerUnavailable",
  "This device is no longer available.": "deviceUnavailable",
  "This request is no longer open.": "requestClosed",
  "Only the two people in this match can cancel it.": "onlyMatchCancel",
  "Only an active match can be cancelled.": "onlyActiveCancel",
  "Enter a valid phone number, including the country code.": "invalidPhone",
  "Only live listings can be edited. Renew it first.": "editLiveListing",
  "This listing is not live.": "listingNotLive",
  "Only closed or expired listings can be renewed.": "renewListing",
  "Only live requests can be edited. Renew it first.": "editLiveRequest",
  "This request is not live.": "requestNotLive",
  "Only closed or expired requests can be renewed.": "renewRequest",
  "Offer already sent": "offerAlreadySent",
  "Already matched": "alreadyMatched",
  "Already offered and declined": "alreadyDeclined",
  "Already offered and withdrawn": "alreadyWithdrawn",
  "This donor already has an offer on it": "donorBusy",
  "Please sign in first.": "signIn",
  "Check the highlighted fields.": "checkFields",
  "Check the phone number.": "checkPhone",
  "Nyeaka isn't available in your country yet, so you can't post or send offers.": "countryUnavailable",
  "Offers are only possible between people in the same country.": "differentCountry",
  "Verify your identity first to post, request or send offers.": "notVerified",
  "Your verification is already being reviewed.": "verifyPending",
  "Your identity is already verified.": "verifyAlready",
  "That document isn't accepted in your country.": "verifyDocType",
  "Enter a valid ID number.": "verifyDocNumber",
  "Upload the required ID photos.": "verifyImages",
  "The ID has expired. Use one that is still valid.": "verifyExpired",
  "Nyeaka isn't available in your country yet.": "countryUnavailableShort",
  "Admins can't delete their account here. Ask another admin to change your role first.": "deleteAdmin",
  "Type your email address to confirm.": "deleteConfirm",
  "We can't verify this document. Try a different one or contact support.": "verifyBlocked",
};

export const BY_CODE: Record<ServiceErrorCode, string> = {
  NOT_FOUND: "notFound",
  FORBIDDEN: "forbidden",
  INVALID: "invalid",
  RATE_LIMITED: "rateLimited",
};

/** Translation key (namespace `errors`) for a service error message. */
export function errorKey(message: string, code?: ServiceErrorCode): string {
  const known = BY_MESSAGE[message];
  if (known) return known;
  if (code) return BY_CODE[code];
  return "generic";
}

/** Key for an already-known message, or null when it isn't one of ours. */
export function knownErrorKey(message: string): string | null {
  return BY_MESSAGE[message] ?? null;
}
