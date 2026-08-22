import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { Company, EnrichedData } from '@prisma/client';
import { PresenceLevel } from '../../common/enums';
import { deserializeCompany } from '../../common/utils/json-fields';
import OpenAI from 'openai';
import { AI_ENRICHMENT_BATCH_SIZE } from '../../common/constants';

type EnrichableCompany = Omit<Company, 'photos' | 'openingHours' | 'rawData'> & {
  photos: string[];
  openingHours: Record<string, any> | null;
  rawData: any;
};

@Injectable()
export class EnrichmentService {
  private readonly logger = new Logger(EnrichmentService.name);
  private ai: OpenAI | null = null;
  private aiModel: string = 'gpt-4o-mini';

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const deepseekKey = this.config.get('DEEPSEEK_API_KEY');
    const openaiKey = this.config.get('openai.apiKey');

    if (deepseekKey) {
      this.ai = new OpenAI({
        apiKey: deepseekKey,
        baseURL: 'https://api.deepseek.com',
      });
      this.aiModel = 'deepseek-chat';
      this.logger.log('Using DeepSeek API for AI enrichment');
    } else if (openaiKey) {
      this.ai = new OpenAI({ apiKey: openaiKey });
      this.aiModel = 'gpt-4o-mini';
      this.logger.log('Using OpenAI API for AI enrichment');
    }
  }

  async enrichCompany(company: Company): Promise<EnrichedData> {
    const existing = await this.prisma.enrichedData.findUnique({
      where: { companyId: company.id },
    });
    if (existing) return existing;

    const analysis = await this.analyzeWithAI(deserializeCompany(company));

    return this.prisma.enrichedData.create({
      data: {
        companyId: company.id,
        qualityScore: analysis.qualityScore,
        presenceLevel: analysis.presenceLevel,
        hasVisualIdentity: analysis.hasVisualIdentity,
        hasModernWebsite: analysis.hasModernWebsite,
        instagramActive: analysis.instagramActive,
        postsFrequently: analysis.postsFrequently,
        hasFewRatings: analysis.hasFewRatings,
        needsMarketing: analysis.needsMarketing,
        needsAutomation: analysis.needsAutomation,
        needsChatbot: analysis.needsChatbot,
        needsNewWebsite: analysis.needsNewWebsite,
        needsPaidTraffic: analysis.needsPaidTraffic,
        analysisText: analysis.analysisText,
      },
    });
  }

  async enrichById(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new Error('Empresa não encontrada');
    return this.enrichCompany(company);
  }

  async enrichBySearchId(searchId: string) {
    const companies = await this.prisma.company.findMany({
      where: { searchId, enrichedData: null },
    });

    let enriched = 0;
    for (const company of companies) {
      try {
        await this.enrichCompany(company);
        enriched++;
      } catch (error: any) {
        this.logger.warn(`Falha para ${company.name}: ${error.message}`);
      }
    }

    return { enriched, total: companies.length };
  }

  async getStats() {
    const [total, enriched, avgScore, byLevel] = await Promise.all([
      this.prisma.company.count(),
      this.prisma.enrichedData.count(),
      this.prisma.enrichedData.aggregate({ _avg: { qualityScore: true } }),
      this.prisma.enrichedData.groupBy({
        by: ['presenceLevel'],
        _count: true,
      }),
    ]);

    return {
      totalCompanies: total,
      enrichedCompanies: enriched,
      notEnriched: total - enriched,
      averageQualityScore: avgScore._avg.qualityScore,
      byPresenceLevel: byLevel,
    };
  }

  private async analyzeWithAI(company: EnrichableCompany): Promise<EnrichmentAnalysis> {
    if (!this.ai) {
      return this.fallbackAnalysis(company);
    }

    try {
      const prompt = this.buildAnalysisPrompt(company);
      const response = await this.ai.chat.completions.create({
        model: this.aiModel,
        messages: [
          {
            role: 'system',
            content: 'Você é um analista de negócios. Analise empresas com base em dados públicos e retorne JSON.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 500,
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);
      return this.normalizeAnalysis(parsed, company);
    } catch (error: any) {
      this.logger.warn(`OpenAI falhou para ${company.name}: ${error.message}`);
      return this.fallbackAnalysis(company);
    }
  }

  private buildAnalysisPrompt(company: EnrichableCompany): string {
    return `
Analise esta empresa com APENAS dados públicos abaixo:
Nome: ${company.name}
Categoria: ${company.category}
Avaliação: ${company.rating || 'N/A'}
Total de Avaliações: ${company.totalRatings || 0}
Tem Website: ${company.hasWebsite ? 'Sim' : 'Não'}
Tem Instagram: ${company.hasInstagram ? 'Sim' : 'Não'}
Tem Facebook: ${company.hasFacebook ? 'Sim' : 'Não'}
Tem WhatsApp: ${company.hasWhatsapp ? 'Sim' : 'Não'}
Tem Email: ${company.hasEmail ? 'Sim' : 'Não'}
Email: ${company.email || 'N/A'}
Instagram: ${company.instagram || 'N/A'}

Retorne JSON com:
{
  "qualityScore": 0-100,
  "presenceLevel": "VERY_LOW"|"LOW"|"MEDIUM"|"HIGH"|"EXCELLENT",
  "hasVisualIdentity": boolean,
  "hasModernWebsite": boolean,
  "instagramActive": boolean,
  "postsFrequently": boolean,
  "hasFewRatings": boolean,
  "needsMarketing": boolean,
  "needsAutomation": boolean,
  "needsChatbot": boolean,
  "needsNewWebsite": boolean,
  "needsPaidTraffic": boolean,
  "analysisText": "justificativa concisa em pt-BR baseada apenas nos dados"
}`;
  }

  private normalizeAnalysis(parsed: any, company: EnrichableCompany): EnrichmentAnalysis {
    return {
      qualityScore: Math.min(100, Math.max(0, parsed.qualityScore || 50)),
      presenceLevel: (parsed.presenceLevel as PresenceLevel) || PresenceLevel.LOW,
      hasVisualIdentity: parsed.hasVisualIdentity || false,
      hasModernWebsite: parsed.hasModernWebsite || false,
      instagramActive: parsed.instagramActive || false,
      postsFrequently: parsed.postsFrequently || false,
      hasFewRatings: parsed.hasFewRatings ?? true,
      needsMarketing: parsed.needsMarketing ?? true,
      needsAutomation: parsed.needsAutomation ?? true,
      needsChatbot: parsed.needsChatbot ?? true,
      needsNewWebsite: parsed.needsNewWebsite ?? true,
      needsPaidTraffic: parsed.needsPaidTraffic ?? true,
      analysisText: parsed.analysisText || 'Análise não disponível.',
    };
  }

  private fallbackAnalysis(company: EnrichableCompany): EnrichmentAnalysis {
    let score = 0;
    if (company.hasWebsite) score += 15;
    if (company.hasInstagram) score += 15;
    if (company.hasFacebook) score += 10;
    if (company.hasEmail) score += 10;
    if (company.hasWhatsapp) score += 10;
    if (company.rating && company.rating >= 4) score += 10;
    if (company.totalRatings && company.totalRatings > 10) score += 10;
    if (company.phone) score += 10;
    if (company.photos?.length) score += 10;

    let level: PresenceLevel = PresenceLevel.VERY_LOW;
    if (score >= 80) level = PresenceLevel.EXCELLENT;
    else if (score >= 60) level = PresenceLevel.HIGH;
    else if (score >= 40) level = PresenceLevel.MEDIUM;
    else if (score >= 20) level = PresenceLevel.LOW;

    const noRating = !company.rating || (company.totalRatings || 0) < 5;
    const noSite = !company.hasWebsite;
    const noInsta = !company.hasInstagram;

    return {
      qualityScore: score,
      presenceLevel: level,
      hasVisualIdentity: company.photos?.length > 0,
      hasModernWebsite: company.hasWebsite,
      instagramActive: company.hasInstagram,
      postsFrequently: false,
      hasFewRatings: noRating,
      needsMarketing: noInsta || noSite,
      needsAutomation: true,
      needsChatbot: !company.hasWebsite,
      needsNewWebsite: noSite,
      needsPaidTraffic: noInsta || noRating,
      analysisText: this.buildFallbackText(company, score),
    };
  }

  private buildFallbackText(company: EnrichableCompany, score: number): string {
    const points: string[] = [];
    if (!company.hasWebsite) points.push('não possui website');
    if (!company.hasInstagram) points.push('não tem Instagram');
    if (!company.hasWhatsapp) points.push('não tem WhatsApp visível');
    if (!company.email) points.push('não tem email público');
    if (!company.rating || (company.totalRatings || 0) < 5) points.push('tem poucas avaliações');

    const resume = points.length > 0 ? `A empresa ${points.join(', ')}.` : 'Boa presença digital.';
    return `Score ${score}/100. ${resume}`;
  }
}

interface EnrichmentAnalysis {
  qualityScore: number;
  presenceLevel: PresenceLevel;
  hasVisualIdentity: boolean;
  hasModernWebsite: boolean;
  instagramActive: boolean;
  postsFrequently: boolean;
  hasFewRatings: boolean;
  needsMarketing: boolean;
  needsAutomation: boolean;
  needsChatbot: boolean;
  needsNewWebsite: boolean;
  needsPaidTraffic: boolean;
  analysisText: string;
}
