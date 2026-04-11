export const ROLES = {
  ADMIN: "admin",
  OPERATOR: "operator",
  FIELD_OPERATOR: "field_operator",
};

export function isValidRole(role) {
  return Object.values(ROLES).includes(role);
}

export function getDefaultRouteByRole(role) {
  switch (role) {
    case ROLES.ADMIN:
      return "/dashboard/admin";
    case ROLES.OPERATOR:
      return "/dashboard/operator";
    case ROLES.FIELD_OPERATOR:
      return "/field-operator";
    default:
      return "/login";
  }
}
