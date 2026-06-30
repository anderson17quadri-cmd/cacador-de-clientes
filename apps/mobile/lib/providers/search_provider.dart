import 'package:flutter/material.dart';
import '../services/search_service.dart';

class SearchProvider extends ChangeNotifier {
  final SearchService _searchService;
  bool _loading = false;
  Map<String, dynamic>? _currentSearch;
  Map<String, dynamic>? _progress;
  List<Map<String, dynamic>> _logs = [];
  List<Map<String, dynamic>> _results = [];
  String? _error;

  SearchProvider(this._searchService);

  bool get loading => _loading;
  Map<String, dynamic>? get currentSearch => _currentSearch;
  Map<String, dynamic>? get progress => _progress;
  List<Map<String, dynamic>> get logs => _logs;
  List<Map<String, dynamic>> get results => _results;
  String? get error => _error;

  Future<void> startSearch({
    required String category,
    String? city,
    String? state,
    String? country,
    int? radius,
  }) async {
    _loading = true;
    _error = null;
    _results = [];
    _logs = [];
    notifyListeners();

    try {
      final response = await _searchService.createSearch(
        category: category,
        city: city,
        state: state,
        country: country,
        radius: radius,
      );
      _currentSearch = response['data'];
      notifyListeners();

      _pollProgress(_currentSearch!['id']);
    } catch (e) {
      _error = e.toString();
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> _pollProgress(String searchId) async {
    bool completed = false;
    while (!completed) {
      await Future.delayed(const Duration(seconds: 3));
      try {
        final progResponse = await _searchService.getSearchProgress(searchId);
        _progress = progResponse['data'];
        notifyListeners();

        final status = _progress!['status'];
        if (status == 'COMPLETED' || status == 'FAILED' || status == 'CANCELLED') {
          completed = true;
          _loading = false;

          if (status == 'COMPLETED') {
            await loadResults(searchId);
          }
          notifyListeners();
        }
      } catch (e) {
        completed = true;
        _error = e.toString();
        _loading = false;
        notifyListeners();
      }
    }
  }

  Future<void> loadResults(String searchId) async {
    try {
      final response = await _searchService.getSearchResults(searchId);
      _results = List<Map<String, dynamic>>.from(response['data']['data'] ?? []);
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  void clearSearch() {
    _currentSearch = null;
    _progress = null;
    _logs = [];
    _results = [];
    _loading = false;
    _error = null;
    notifyListeners();
  }
}
