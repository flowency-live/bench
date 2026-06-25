export { generateMagicLinkToken, hashToken } from './token-generator';
export {
  validateMagicLink,
  isLinkExpired,
  isLinkActive,
  type MagicLinkValidationResult,
} from './link-validation';
