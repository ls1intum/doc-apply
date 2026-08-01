import {
  JobFormDTOFundingTypeEnum,
  JobFormDTOLocationEnum,
  JobFormDTOSubjectAreaEnum,
  JobFormDTOTvlGradeEnum,
} from 'app/generated/model/job-form-dto';
import { RecommendationType } from 'app/generated/model/recommendation-type';
const BASIC_INFO_I18N = 'jobCreationForm.basicInformationSection';

export const locations = [
  { value: JobFormDTOLocationEnum.Garching, name: `${BASIC_INFO_I18N}.locations.Garching` },
  { value: JobFormDTOLocationEnum.GarchingHochbrueck, name: `${BASIC_INFO_I18N}.locations.GarchingHochbrueck` },
  { value: JobFormDTOLocationEnum.Heilbronn, name: `${BASIC_INFO_I18N}.locations.Heilbronn` },
  { value: JobFormDTOLocationEnum.Munich, name: `${BASIC_INFO_I18N}.locations.Munich` },
  { value: JobFormDTOLocationEnum.Singapore, name: `${BASIC_INFO_I18N}.locations.Singapore` },
  { value: JobFormDTOLocationEnum.Straubing, name: `${BASIC_INFO_I18N}.locations.Straubing` },
  { value: JobFormDTOLocationEnum.Weihenstephan, name: `${BASIC_INFO_I18N}.locations.Weihenstephan` },
];
export const subjectAreas = [
  { value: JobFormDTOSubjectAreaEnum.AerospaceEngineering, name: `${BASIC_INFO_I18N}.subjectAreas.AerospaceEngineering` },
  { value: JobFormDTOSubjectAreaEnum.AgriculturalEngineering, name: `${BASIC_INFO_I18N}.subjectAreas.AgriculturalEngineering` },
  { value: JobFormDTOSubjectAreaEnum.AgriculturalScience, name: `${BASIC_INFO_I18N}.subjectAreas.AgriculturalScience` },
  { value: JobFormDTOSubjectAreaEnum.Architecture, name: `${BASIC_INFO_I18N}.subjectAreas.Architecture` },
  { value: JobFormDTOSubjectAreaEnum.ArtHistory, name: `${BASIC_INFO_I18N}.subjectAreas.ArtHistory` },
  { value: JobFormDTOSubjectAreaEnum.AutomotiveEngineering, name: `${BASIC_INFO_I18N}.subjectAreas.AutomotiveEngineering` },
  { value: JobFormDTOSubjectAreaEnum.Bioengineering, name: `${BASIC_INFO_I18N}.subjectAreas.Bioengineering` },
  { value: JobFormDTOSubjectAreaEnum.Biochemistry, name: `${BASIC_INFO_I18N}.subjectAreas.Biochemistry` },
  { value: JobFormDTOSubjectAreaEnum.Biology, name: `${BASIC_INFO_I18N}.subjectAreas.Biology` },
  { value: JobFormDTOSubjectAreaEnum.BiomedicalEngineering, name: `${BASIC_INFO_I18N}.subjectAreas.BiomedicalEngineering` },
  { value: JobFormDTOSubjectAreaEnum.Biotechnology, name: `${BASIC_INFO_I18N}.subjectAreas.Biotechnology` },
  { value: JobFormDTOSubjectAreaEnum.Chemistry, name: `${BASIC_INFO_I18N}.subjectAreas.Chemistry` },
  { value: JobFormDTOSubjectAreaEnum.ComputerEngineering, name: `${BASIC_INFO_I18N}.subjectAreas.ComputerEngineering` },
  { value: JobFormDTOSubjectAreaEnum.ComputerScience, name: `${BASIC_INFO_I18N}.subjectAreas.ComputerScience` },
  { value: JobFormDTOSubjectAreaEnum.ComputerVision, name: `${BASIC_INFO_I18N}.subjectAreas.ComputerVision` },
  { value: JobFormDTOSubjectAreaEnum.DataScience, name: `${BASIC_INFO_I18N}.subjectAreas.DataScience` },
  { value: JobFormDTOSubjectAreaEnum.Economics, name: `${BASIC_INFO_I18N}.subjectAreas.Economics` },
  { value: JobFormDTOSubjectAreaEnum.EducationTechnology, name: `${BASIC_INFO_I18N}.subjectAreas.EducationTechnology` },
  { value: JobFormDTOSubjectAreaEnum.ElectricalEngineering, name: `${BASIC_INFO_I18N}.subjectAreas.ElectricalEngineering` },
  { value: JobFormDTOSubjectAreaEnum.EnergySystems, name: `${BASIC_INFO_I18N}.subjectAreas.EnergySystems` },
  { value: JobFormDTOSubjectAreaEnum.EnvironmentalBiology, name: `${BASIC_INFO_I18N}.subjectAreas.EnvironmentalBiology` },
  { value: JobFormDTOSubjectAreaEnum.EnvironmentalChemistry, name: `${BASIC_INFO_I18N}.subjectAreas.EnvironmentalChemistry` },
  { value: JobFormDTOSubjectAreaEnum.EnvironmentalEngineering, name: `${BASIC_INFO_I18N}.subjectAreas.EnvironmentalEngineering` },
  { value: JobFormDTOSubjectAreaEnum.EnvironmentalLaw, name: `${BASIC_INFO_I18N}.subjectAreas.EnvironmentalLaw` },
  { value: JobFormDTOSubjectAreaEnum.EnvironmentalScience, name: `${BASIC_INFO_I18N}.subjectAreas.EnvironmentalScience` },
  { value: JobFormDTOSubjectAreaEnum.FinancialEngineering, name: `${BASIC_INFO_I18N}.subjectAreas.FinancialEngineering` },
  { value: JobFormDTOSubjectAreaEnum.FoodTechnology, name: `${BASIC_INFO_I18N}.subjectAreas.FoodTechnology` },
  { value: JobFormDTOSubjectAreaEnum.Geology, name: `${BASIC_INFO_I18N}.subjectAreas.Geology` },
  { value: JobFormDTOSubjectAreaEnum.Geosciences, name: `${BASIC_INFO_I18N}.subjectAreas.Geosciences` },
  { value: JobFormDTOSubjectAreaEnum.IndustrialEngineering, name: `${BASIC_INFO_I18N}.subjectAreas.IndustrialEngineering` },
  { value: JobFormDTOSubjectAreaEnum.InformationSystems, name: `${BASIC_INFO_I18N}.subjectAreas.InformationSystems` },
  { value: JobFormDTOSubjectAreaEnum.LifeSciences, name: `${BASIC_INFO_I18N}.subjectAreas.LifeSciences` },
  { value: JobFormDTOSubjectAreaEnum.Linguistics, name: `${BASIC_INFO_I18N}.subjectAreas.Linguistics` },
  { value: JobFormDTOSubjectAreaEnum.MarineBiology, name: `${BASIC_INFO_I18N}.subjectAreas.MarineBiology` },
  { value: JobFormDTOSubjectAreaEnum.MaterialsScience, name: `${BASIC_INFO_I18N}.subjectAreas.MaterialsScience` },
  { value: JobFormDTOSubjectAreaEnum.Mathematics, name: `${BASIC_INFO_I18N}.subjectAreas.Mathematics` },
  { value: JobFormDTOSubjectAreaEnum.MechanicalEngineering, name: `${BASIC_INFO_I18N}.subjectAreas.MechanicalEngineering` },
  { value: JobFormDTOSubjectAreaEnum.MedicalInformatics, name: `${BASIC_INFO_I18N}.subjectAreas.MedicalInformatics` },
  { value: JobFormDTOSubjectAreaEnum.Neuroscience, name: `${BASIC_INFO_I18N}.subjectAreas.Neuroscience` },
  { value: JobFormDTOSubjectAreaEnum.Philosophy, name: `${BASIC_INFO_I18N}.subjectAreas.Philosophy` },
  { value: JobFormDTOSubjectAreaEnum.Physics, name: `${BASIC_INFO_I18N}.subjectAreas.Physics` },
  { value: JobFormDTOSubjectAreaEnum.Psychology, name: `${BASIC_INFO_I18N}.subjectAreas.Psychology` },
  { value: JobFormDTOSubjectAreaEnum.SoftwareEngineering, name: `${BASIC_INFO_I18N}.subjectAreas.SoftwareEngineering` },
  { value: JobFormDTOSubjectAreaEnum.SportsScience, name: `${BASIC_INFO_I18N}.subjectAreas.SportsScience` },
  { value: JobFormDTOSubjectAreaEnum.Statistics, name: `${BASIC_INFO_I18N}.subjectAreas.Statistics` },
  { value: JobFormDTOSubjectAreaEnum.Telecommunications, name: `${BASIC_INFO_I18N}.subjectAreas.Telecommunications` },
  { value: JobFormDTOSubjectAreaEnum.UrbanPlanning, name: `${BASIC_INFO_I18N}.subjectAreas.UrbanPlanning` },
];
export const recommendationTypes = [
  { value: RecommendationType.LetterOnly, name: `${BASIC_INFO_I18N}.recommendationTypes.LetterOnly` },
  { value: RecommendationType.EvaluationOnly, name: `${BASIC_INFO_I18N}.recommendationTypes.EvaluationOnly` },
  { value: RecommendationType.LetterAndEvaluation, name: `${BASIC_INFO_I18N}.recommendationTypes.LetterAndEvaluation` },
];
export const fundingTypes = [
  { value: JobFormDTOFundingTypeEnum.FullyFunded, name: `${BASIC_INFO_I18N}.fundingTypes.FullyFunded` },
  { value: JobFormDTOFundingTypeEnum.GovernmentFunded, name: `${BASIC_INFO_I18N}.fundingTypes.GovernmentFunded` },
  { value: JobFormDTOFundingTypeEnum.IndustrySponsored, name: `${BASIC_INFO_I18N}.fundingTypes.IndustrySponsored` },
  { value: JobFormDTOFundingTypeEnum.ResearchGrant, name: `${BASIC_INFO_I18N}.fundingTypes.ResearchGrant` },
  { value: JobFormDTOFundingTypeEnum.Scholarship, name: `${BASIC_INFO_I18N}.fundingTypes.Scholarship` },
  { value: JobFormDTOFundingTypeEnum.SelfFunded, name: `${BASIC_INFO_I18N}.fundingTypes.SelfFunded` },
  { value: JobFormDTOFundingTypeEnum.PartiallyFunded, name: `${BASIC_INFO_I18N}.fundingTypes.PartiallyFunded` },
];
export const tvlGrades = [
  { value: JobFormDTOTvlGradeEnum.E10, name: JobFormDTOTvlGradeEnum.E10 },
  { value: JobFormDTOTvlGradeEnum.E11, name: JobFormDTOTvlGradeEnum.E11 },
  { value: JobFormDTOTvlGradeEnum.E12, name: JobFormDTOTvlGradeEnum.E12 },
  { value: JobFormDTOTvlGradeEnum.E13, name: JobFormDTOTvlGradeEnum.E13 },
  { value: JobFormDTOTvlGradeEnum.E14, name: JobFormDTOTvlGradeEnum.E14 },
  { value: JobFormDTOTvlGradeEnum.E15, name: JobFormDTOTvlGradeEnum.E15 },
];

export const locationNameToValueMap = new Map(locations.map(option => [option.name, option.value]));
export const locationValueToNameMap = new Map(locations.map(option => [option.value as string, option.name]));
export const subjectAreaNameToValueMap = new Map(subjectAreas.map(option => [option.name, option.value]));
export const subjectAreaValueToNameMap = new Map(subjectAreas.map(option => [option.value as string, option.name]));
export const fundingTypeValueToNameMap = new Map(fundingTypes.map(option => [option.value as string, option.name]));
export const tvlGradesValueToNameMap = new Map(tvlGrades.map(option => [option.value as string, option.name]));
export const recommendationTypeValueToNameMap = new Map(recommendationTypes.map(option => [option.value as string, option.name]));

export function mapLocationNames(translationKeys: string[]): JobFormDTOLocationEnum[] {
  return translationKeys
    .map(key => locationNameToValueMap.get(key))
    .filter((value): value is JobFormDTOLocationEnum => value !== undefined);
}

export function mapSubjectAreaNames(translationKeys: string[]): JobFormDTOSubjectAreaEnum[] {
  return translationKeys
    .map(key => subjectAreaNameToValueMap.get(key))
    .filter((value): value is JobFormDTOSubjectAreaEnum => value !== undefined);
}

/**
 * Generic resolver to convert a raw value to its i18n translation key using a provided map.
 * - Returns an empty string when value is null/undefined/blank.
 * - Normalizes input via toEnumString before lookup.
 * - Falls back to normalized value if no mapping exists.
 */
function getTranslationKey(value: string | undefined, valueToNameMap: Map<string, string>): string {
  if (value == null || value.trim() === '') return '';
  const normalized = toEnumString(value);
  if (normalized === '') return '';
  return valueToNameMap.get(normalized) ?? normalized;
}

export function getLocationTranslationKey(location: string | undefined): string {
  return getTranslationKey(location, locationValueToNameMap);
}

export function getFundingTypeTranslationKey(fundingType: string | undefined): string {
  return getTranslationKey(fundingType, fundingTypeValueToNameMap);
}

export function getTvlGradesTranslationKey(tvlGrade: string | undefined): string {
  return getTranslationKey(tvlGrade, tvlGradesValueToNameMap);
}

export function getSubjectAreaTranslationKey(subjectArea: string | undefined): string {
  return getTranslationKey(subjectArea, subjectAreaValueToNameMap);
}

export function getRecommendationTypeTranslationKey(recommendationType: string | undefined): string {
  return getTranslationKey(recommendationType, recommendationTypeValueToNameMap);
}

/**
 * Converts a normal string to its enum format string.
 * @param value - A string (e.g., "Garching Hochbrueck")
 * @returns A string in enum format (e.g., "GARCHING_HOCHBRUECK")
 */
export function toEnumString(value: string): string {
  if (/^[A-Z_]+$/.test(value)) {
    return value;
  }
  return value
    .trim()
    .split(/\s+/)
    .map((part: string) => part.replace(/[^A-Za-z0-9]/g, ''))
    .filter((part: string) => part.length > 0)
    .map((part: string) => part.toUpperCase())
    .join('_');
}
