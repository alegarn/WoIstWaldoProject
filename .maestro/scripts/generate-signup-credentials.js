const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const emailPrefix = (typeof env !== "undefined" && env.SIGNUP_EMAIL_PREFIX) || "e2e.signup";
const emailDomain = (typeof env !== "undefined" && env.SIGNUP_EMAIL_DOMAIN) || "woistwaldo.test";
const usernamePrefix = (typeof env !== "undefined" && env.SIGNUP_USERNAME_PREFIX) || "e2e_signup";
const password = (typeof env !== "undefined" && env.SIGNUP_PASSWORD) || "E2eSignup123!";

output.signup = {
  email: `${emailPrefix}.${suffix}@${emailDomain}`,
  password,
  username: `${usernamePrefix}_${suffix}`,
};
