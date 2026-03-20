const ROLES_CONFIG_MAP = {
  'cadasataller@gmail.com':          { role: 'admin', area: null },
  'eli.taller.cadasa05@gmail.com':   { role: 'area',  area: 'Cosecha Mecanizada' },
};

const RolesConfig = {
  getForEmail(email) {
    if (!email) return { role: 'area', area: null };
    return ROLES_CONFIG_MAP[email.toLowerCase()] ?? { role: 'area', area: null };
  },
  isAdmin(email) {
    return this.getForEmail(email).role === 'admin';
  },
  getArea(email) {
    return this.getForEmail(email).area;
  },
};

window.RolesConfig = RolesConfig;