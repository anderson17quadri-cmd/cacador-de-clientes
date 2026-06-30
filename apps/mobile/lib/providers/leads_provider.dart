import 'package:flutter/material.dart';
import '../services/api_service.dart';

class LeadsProvider extends ChangeNotifier {
  final ApiService _api;
  bool _loading = false;
  List<Map<String, dynamic>> _leads = [];
  List<Map<String, dynamic>> _favorites = [];
  Map<String, dynamic>? _stats;
  int _page = 1;
  int _totalPages = 1;

  LeadsProvider(this._api);

  bool get loading => _loading;
  List<Map<String, dynamic>> get leads => _leads;
  List<Map<String, dynamic>> get favorites => _favorites;
  Map<String, dynamic>? get stats => _stats;
  int get page => _page;
  int get totalPages => _totalPages;

  Future<void> loadLeads({int page = 1, Map<String, String>? filters}) async {
    _loading = true;
    notifyListeners();

    try {
      final response = await _api.get('/companies', params: {
        'page': page.toString(),
        'limit': '20',
        ...?filters,
      });
      final data = response['data'];
      _leads = List<Map<String, dynamic>>.from(data['data'] ?? []);
      _page = data['meta']['page'] ?? 1;
      _totalPages = data['meta']['totalPages'] ?? 1;
    } catch (_) {}

    _loading = false;
    notifyListeners();
  }

  Future<void> loadFavorites() async {
    _loading = true;
    notifyListeners();

    try {
      final response = await _api.get('/favorites');
      _favorites = List<Map<String, dynamic>>.from(
        (response['data']['data'] as List? ?? []).map((f) => f['company']),
      );
    } catch (_) {}

    _loading = false;
    notifyListeners();
  }

  Future<void> loadStats() async {
    try {
      final response = await _api.get('/leads/stats');
      _stats = response['data'];
      notifyListeners();
    } catch (_) {}
  }

  Future<void> toggleFavorite(String companyId) async {
    try {
      final isFav = _favorites.any((f) => f['id'] == companyId);
      if (isFav) {
        await _api.delete('/favorites/$companyId');
        _favorites.removeWhere((f) => f['id'] == companyId);
      } else {
        await _api.post('/favorites/$companyId');
      }
      notifyListeners();
    } catch (_) {}
  }
}
