import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get('github.clientId'),
      clientSecret: config.get('github.clientSecret'),
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
