// One line under the in-game loader. Chuck, playing host, while a chunk
// arrives. Shown only after the age door (DialogLoader lives in App, and
// App does not mount until the door has passed). The pre-JS loader and
// BootScreen stay plain: a minor can still be looking at those.

export const LOADING_TIP_MAX = 78;

export const LOADING_TIPS = Object.freeze([
  'Chuck is pouring. He waters his own. Yours he leaves alone.',
  'The back booth is taken. It has been taken since you walked in.',
  'Hands where he can see them. He would rather they were not.',
  'He will buy the first round. He will invent the second.',
  'If the bear winks, it is not a tell. It is an offer.',
  'Last call is a suggestion. Chuck treats it like a dare.',
  'Sit close. He does not do well with an empty chair.',
  'The house band knows one song. It is not a hymn.',
  'His crew is in the packs. He pretends not to look.',
]);

/** One tip. `random` returns a number in [0, 1). */
export const loadingTip = (random = Math.random) => {
  const i = Math.min(LOADING_TIPS.length - 1, Math.floor(random() * LOADING_TIPS.length));
  return LOADING_TIPS[i];
};
