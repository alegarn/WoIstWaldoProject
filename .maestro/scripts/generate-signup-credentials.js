const randomSuffix = `${Date.now()}-${faker.number().digits(6)}`;
const emailPrefix = typeof SIGNUP_EMAIL_PREFIX === 'string' ? SIGNUP_EMAIL_PREFIX : 'e2e.signup';
const emailDomain = typeof SIGNUP_EMAIL_DOMAIN === 'string' ? SIGNUP_EMAIL_DOMAIN : 'woistwaldo.test';
const usernamePrefix = typeof SIGNUP_USERNAME_PREFIX === 'string' ? SIGNUP_USERNAME_PREFIX : 'e2e_signup';
const password = typeof SIGNUP_PASSWORD === 'string' ? SIGNUP_PASSWORD : 'E2eSignup123!';

output.signup = {
  email: `${emailPrefix}.${randomSuffix}@${emailDomain}`,
  password,
  username: `${usernamePrefix}_${randomSuffix}`,
};