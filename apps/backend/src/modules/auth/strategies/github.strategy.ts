import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(config: ConfigService) {
    super({
      // passport-oauth2 throws at construction if these are empty, so we
      // fall back to placeholders when GitHub OAuth isn't configured -
      // the /auth/github routes simply fail at GitHub's end instead of
      // crashing the whole app on boot.
      clientID: config.get('github.clientId') || 'not-configured',
      clientSecret: config.get('github.clientSecret') || 'not-configured',
      callbackURL: `${config.get('API_URL', 'http://localhost:3001')}/api/auth/github/callback`,
      scope: ['user:email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: Function,
  ): Promise<any> {
    const { username, photos, emails } = profile;
    const user = {
      email: emails?.[0]?.value || `${username}@github.com`,
      name: profile.displayName || username,
      githubId: profile.id,
      avatarUrl: photos?.[0]?.value,
    };
    done(null, user);
  }
}
