import { Supplier } from '../../types';

export const MOCK_SUPPLIERS: Supplier[] = [
  {
    id: 's1',
    name: 'L\'Oréal Professionnel',
    contactName: 'Jean Dupont',
    email: 'contact@loreal-pro.com',
    phone: '01 45 67 89 10',
    website: 'www.lorealprofessionnel.fr',
    category: 'Produits Coiffure',
    paymentTerms: '30 jours fin de mois',
    active: true,
    notes: 'Fournisseur principal pour les colorations.'
  },
  {
    id: 's2',
    name: 'GHD France',
    contactName: 'Sophie Martin',
    email: 'support@ghdhair.com',
    phone: '04 78 90 12 34',
    category: 'Matériel Électrique',
    paymentTerms: 'Paiement à la commande',
    active: true,
    address: '12 Rue de la République, Lyon'
  },
  {
    id: 's3',
    name: 'Ikea Business',
    contactName: 'Service Pro',
    email: 'business.fr@ikea.com',
    phone: '09 69 36 20 06',
    category: 'Mobilier',
    active: true,
  }
];