import { defineField, defineType } from 'sanity';

export default defineType({
  name: 'tournamentState',
  title: 'Tournament State',
  type: 'document',
  fields: [
    defineField({
      name: 'tournamentId',
      title: 'Tournament ID',
      type: 'string',
      validation: (rule) => rule.required()
    }),
    defineField({
      name: 'stateJson',
      title: 'State JSON',
      type: 'text',
      validation: (rule) => rule.required()
    }),
    defineField({
      name: 'updatedAt',
      title: 'Updated At',
      type: 'datetime',
      validation: (rule) => rule.required()
    })
  ],
  preview: {
    select: {
      title: 'tournamentId',
      subtitle: 'updatedAt'
    }
  }
});
