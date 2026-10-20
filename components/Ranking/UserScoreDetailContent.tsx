import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

export type UserScoreDetailRow = {
  field: string;
  label: string;
  value: number;
};

type UserScoreDetailContentProps = {
  name: string;
  rows: UserScoreDetailRow[];
  accentColor: string;
  hairline: string;
  wash: string;
};

const SECTIONS: Array<{ titleKey: string; fields: string[] }> = [
  {
    titleKey: 'ranking.detail.scoresTitle',
    fields: ['total_score', 'point_score', 'shape_score', 'total_hide_score'],
  },
  {
    titleKey: 'ranking.detail.activityTitle',
    fields: ['hide_count', 'guess_count'],
  },
  {
    titleKey: 'ranking.detail.breakdownTitle',
    fields: [
      'total_point_guess_score',
      'total_shape_guess_score',
      'total_point_hide_score',
      'total_shape_hide_score',
    ],
  },
];

const INK = '#1D133D';
const MUTED_INK = 'rgba(29, 19, 61, 0.55)';
const EMPHASIZED_FIELD = 'total_score';

export default function UserScoreDetailContent({
  name,
  rows,
  accentColor,
  hairline,
  wash,
}: UserScoreDetailContentProps) {
  const { t } = useTranslation();

  const rowsByField = new Map(rows.map((row) => [row.field, row]));

  return (
    <View style={styles.body}>
      <Text testID="ranking.detail.title" style={[styles.title, { color: accentColor }]}>
        {t('ranking.detail.title', { name })}
      </Text>
      {SECTIONS.map(({ titleKey, fields }) => {
        const sectionRows = fields
          .map((field) => rowsByField.get(field))
          .filter((row): row is UserScoreDetailRow => row != null);

        if (sectionRows.length === 0) return null;

        return (
          <View key={titleKey} style={styles.section}>
            <Text testID={titleKey} style={styles.sectionHeader}>
              {t(titleKey)}
            </Text>
            <View style={[styles.hairline, { backgroundColor: hairline }]} />
            <View style={[styles.band, { backgroundColor: wash }]}>
              {sectionRows.map((row) => {
                const isTotal = row.field === EMPHASIZED_FIELD;
                return (
                  <Text
                    key={row.field}
                    testID={`ranking.detail.field.${row.field}`}
                    style={[styles.row, isTotal && { color: accentColor }, isTotal && styles.totalRow]}
                  >
                    {t(row.label, { value: row.value })}
                  </Text>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    width: '100%',
  },
  title: {
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 6,
    textAlign: 'center',
    includeFontPadding: false,
  },
  section: {
    marginTop: 6,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: MUTED_INK,
    textTransform: 'uppercase',
    includeFontPadding: false,
  },
  hairline: {
    height: 1,
    marginTop: 2,
    marginBottom: 4,
  },
  band: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  row: {
    fontSize: 14,
    color: INK,
    paddingVertical: 4,
    includeFontPadding: false,
  },
  totalRow: {
    fontWeight: '700',
    fontSize: 16,
  },
});
