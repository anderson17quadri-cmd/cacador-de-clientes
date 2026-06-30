import 'api_service.dart';

class SearchService {
  final ApiService _api;
  SearchService(this._api);

  Future<Map<String, dynamic>> createSearch({
    required String category,
    String? city,
    String? state,
    String? country,
    int? radius,
  }) async {
    return _api.post('/search', body: {
      'category': category,
      'city': city,
      'state': state,
      'country': country ?? 'Brasil',
      'radius': radius ?? 5000,
    });
  }

  Future<Map<String, dynamic>> getSearchProgress(String searchId) async {
    return _api.get('/search/$searchId/progress');
  }

  Future<Map<String, dynamic>> getSearchResults(String searchId, {int page = 1, int limit = 20}) async {
    return _api.get('/search/$searchId/results', params: {
      'page': page.toString(),
      'limit': limit.toString(),
    });
  }

  Future<Map<String, dynamic>> getCompanies({int page = 1, int limit = 20, Map<String, String>? filters}) async {
    final params = <String, String>{'page': page.toString(), 'limit': limit.toString()};
    if (filters != null) params.addAll(filters);
    return _api.get('/companies', params: params);
  }

  Future<Map<String, dynamic>> getLeadStats() async {
    return _api.get('/leads/stats');
  }

  Future<Map<String, dynamic>> addFavorite(String companyId) async {
    return _api.post('/favorites/$companyId');
  }

  Future<Map<String, dynamic>> removeFavorite(String companyId) async {
    return _api.delete('/favorites/$companyId');
  }

  Future<Map<String, dynamic>> getFavorites({int page = 1, int limit = 20}) async {
    return _api.get('/favorites', params: {'page': page.toString(), 'limit': limit.toString()});
  }
}
