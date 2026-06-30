import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:provider/provider.dart';
import '../providers/leads_provider.dart';

class LeadDetailScreen extends StatelessWidget {
  final dynamic lead;

  const LeadDetailScreen({super.key, required this.lead});

  @override
  Widget build(BuildContext context) {
    final leadsProv = context.read<LeadsProvider>();
    final isFav = leadsProv.favorites.any((f) => f['id'] == lead['id']);

    return Scaffold(
      appBar: AppBar(
        title: Text(lead['name'] ?? 'Detalhes'),
        actions: [
          IconButton(
            icon: Icon(isFav ? Icons.star : Icons.star_border, color: Colors.amber),
            onPressed: () => leadsProv.toggleFavorite(lead['id']),
          ),
        ],
      ),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(lead['name'] ?? '', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
                  if (lead['category'] != null)
                    Text(lead['category'], style: TextStyle(color: Colors.grey[400])),
                ],
              ),
            ),
            if (lead['rating'] != null)
              Chip(
                avatar: const Icon(Icons.star, size: 16, color: Colors.amber),
                label: Text('${lead['rating']}'),
              ),
          ],
        ),
        const SizedBox(height: 16),
        if (lead['enrichedData']?['analysisText'] != null)
          Card(
            color: const Color(0xFF7C3AED).withOpacity(0.1),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Text(lead['enrichedData']['analysisText']),
            ),
          ),
        const SizedBox(height: 16),
        _buildInfoRow(Icons.location_on, 'Endereço', lead['address']),
        _buildInfoRow(Icons.phone, 'Telefone', lead['phone']),
        _buildInfoRow(Icons.email, 'Email', lead['email']),
        _buildInfoRow(Icons.language, 'Website', lead['website']),
        _buildInfoRow(Icons.camera_alt, 'Instagram', lead['instagram']),
        const SizedBox(height: 24),
        if (lead['phone'] != null)
          _buildActionButton(context, Icons.phone, 'Ligar', () => launchUrl(Uri.parse('tel:${lead['phone']}'))),
        if (lead['hasWhatsapp'] == true && lead['phone'] != null)
          _buildActionButton(context, Icons.chat, 'WhatsApp', () => launchUrl(Uri.parse('https://wa.me/${(lead['phone'] as String).replaceAll(RegExp(r'\D'), '')}'))),
        if (lead['website'] != null)
          _buildActionButton(context, Icons.open_in_browser, 'Abrir Website', () => launchUrl(Uri.parse(lead['website']))),
        if (lead['instagram'] != null)
          _buildActionButton(context, Icons.camera_alt, 'Instagram', () => launchUrl(Uri.parse('https://instagram.com/${lead['instagram']}'))),
        if (lead['googleMapsLink'] != null)
          _buildActionButton(context, Icons.map, 'Google Maps', () => launchUrl(Uri.parse(lead['googleMapsLink']))),
      ]),
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String? value) {
    if (value == null || value.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(icon, size: 18, color: Colors.grey),
          const SizedBox(width: 12),
          Text(label, style: const TextStyle(color: Colors.grey)),
          const SizedBox(width: 8),
          Expanded(child: Text(value, style: const TextStyle(fontWeight: FontWeight.w500))),
        ],
      ),
    );
  }

  Widget _buildActionButton(BuildContext context, IconData icon, String label, VoidCallback onTap) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: SizedBox(
        height: 48,
        child: OutlinedButton.icon(
          onPressed: onTap,
          icon: Icon(icon, size: 20),
          label: Text(label),
        ),
      ),
    );
  }
}
