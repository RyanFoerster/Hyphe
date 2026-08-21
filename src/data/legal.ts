import { site } from './site';

export interface PageLegale {
  slug: 'mentions-legales' | 'confidentialite';
  titre: string;
  corps: string;
}

export const identite = `studio Hyphe — [forme juridique], [adresse complète], Liège, Belgique. Nº BCE [0XXX.XXX.XXX]. TVA [BE 0XXX.XXX.XXX]. Contact : ${site.email}.`;

export const pagesLegales: Record<PageLegale['slug'], PageLegale> = {
  'mentions-legales': {
    slug: 'mentions-legales',
    titre: 'Mentions légales',
    corps:
      'Hébergement : [hébergeur, adresse]. Directeur de la publication : [nom]. L’ensemble des contenus (textes, planches, code) est la propriété de studio Hyphe, sauf mention contraire.',
  },
  confidentialite: {
    slug: 'confidentialite',
    titre: 'Politique de confidentialité',
    corps:
      'Les données transmises via le formulaire de contact (nom, e-mail, message) servent uniquement à répondre à votre demande. Elles ne sont ni revendues, ni transmises à des tiers, et sont conservées au maximum [durée]. Vous pouvez demander leur suppression à tout moment. Ce site ne dépose aucun cookie de suivi.',
  },
};
