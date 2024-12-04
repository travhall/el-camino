import { CollectionConfig, Access, FieldAccess } from 'payload';

type UserType = {
  id: string;
  role?: 'admin' | 'editor' | 'author';
};

const isAdmin: Access = ({ req }) => {
  const user = req.user as UserType | null;
  return Boolean(user?.role === 'admin');
};

const isAdminOrSelf: Access = ({ req, id }) => {
  const user = req.user as UserType | null;
  if (!user) return false;
  return user.role === 'admin' || user.id === id;
};

const isAdminFieldLevel: FieldAccess = ({ req }) => {
  const user = req.user as UserType | null;
  return Boolean(user?.role === 'admin');
};

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    useAPIKey: true,
    verify: true,
    maxLoginAttempts: 5,
    lockTime: 600000,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'role', 'updatedAt'],
  },
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdminOrSelf,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'author',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Editor', value: 'editor' },
        { label: 'Author', value: 'author' },
      ],
      access: {
        update: isAdminFieldLevel,
      },
    },
    {
      name: 'avatar',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'bio',
      type: 'textarea',
    },
    {
      name: 'social',
      type: 'group',
      fields: [
        {
          name: 'twitter',
          type: 'text',
        },
        {
          name: 'linkedin',
          type: 'text',
        },
        {
          name: 'website',
          type: 'text',
        },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        if (operation === 'create' && !data.role) {
          data.role = 'author';
        }
        return data;
      },
    ],
  },
};