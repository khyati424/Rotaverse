import 'dart:convert';
import 'dart:io';
import 'package:businessmen/data/mock_data/mock_businesses.dart';
import 'package:businessmen/data/mock_data/mock_cities_sectors.dart';

void main() {
  const encoder = JsonEncoder.withIndent('  ');

  final citiesJson = mockGujaratCities.map((c) => {
    'id': c.id,
    'name': c.name,
    'state': c.state,
    'imageUrl': c.imageUrl,
    'businessCount': c.businessCount,
  }).toList();

  final sectorsJson = mockSectors.map((s) => {
    'id': s.id,
    'name': s.name,
    'businessCount': s.businessCount,
  }).toList();

  final categoriesJson = mockCategories.map((c) => {
    'id': c.id,
    'name': c.name,
    'subtitle': c.subtitle,
    'countText': c.countText,
    'imageUrl': c.imageUrl,
  }).toList();

  final businessesJson = mockBusinesses.map((b) => b.toJson()).toList();

  final userProfileJson = {
    'id': 'usr_1',
    'name': 'Darshan Pambhar',
    'email': 'darshan.pambhar@gmail.com',
    'phoneNumber': '+91 98765 43210',
    'avatarUrl': 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=600&auto=format&fit=crop&q=80',
  };

  final notificationsJson = [
    {
      'id': 'notif_1',
      'title': 'New Specialist in Surat!',
      'subtitle': 'Dr. Mehul Desai (Cardiologist) is now available for appointments on Ghod Dod Road.',
      'time': '10 mins ago',
      'unread': true,
    },
    {
      'id': 'notif_2',
      'title': 'Exclusive Dining Discount',
      'subtitle': 'Enjoy 20% off your next dinner at The Grand Heritage this weekend.',
      'time': '2 hours ago',
      'unread': true,
    },
    {
      'id': 'notif_3',
      'title': 'Welcome to BizFinder',
      'subtitle': 'Discover trusted doctors, salons, gyms, and local services near you.',
      'time': 'Yesterday',
      'unread': false,
    },
  ];

  final faqsJson = [
    {
      'id': 1,
      'question': 'How do I call a business or doctor?',
      'answer': 'Simply tap the Call button on any card or detail screen. Your phone dialer will open with the number pre-filled.',
    },
    {
      'id': 2,
      'question': 'How do I get directions to a clinic or store?',
      'answer': 'Tap "Directions" on the detail page or "Open in Google Maps" on the Location screen to view turn-by-turn routing.',
    },
    {
      'id': 3,
      'question': 'How do I filter businesses by rating or city?',
      'answer': 'Use the filter chips at the top of the search and listing screens or tap the filter sliders icon to open all filter options.',
    },
    {
      'id': 4,
      'question': 'How do I switch between Dark and Light themes?',
      'answer': 'Go to your Profile tab and toggle the theme switch. BizFinder will remember your selection permanently.',
    },
  ];

  final allData = {
    'cities': citiesJson,
    'sectors': sectorsJson,
    'categories': categoriesJson,
    'businesses': businessesJson,
    'userProfile': userProfileJson,
    'notifications': notificationsJson,
    'faqs': faqsJson,
  };

  // Ensure directory exists
  final dir = Directory('static_data');
  if (!dir.existsSync()) {
    dir.createSync(recursive: true);
  }

  // Write individual files
  File('static_data/cities.json').writeAsStringSync(encoder.convert(citiesJson));
  File('static_data/sectors.json').writeAsStringSync(encoder.convert(sectorsJson));
  File('static_data/categories.json').writeAsStringSync(encoder.convert(categoriesJson));
  File('static_data/businesses.json').writeAsStringSync(encoder.convert(businessesJson));
  File('static_data/user_profile.json').writeAsStringSync(encoder.convert(userProfileJson));
  File('static_data/notifications.json').writeAsStringSync(encoder.convert(notificationsJson));
  File('static_data/faqs.json').writeAsStringSync(encoder.convert(faqsJson));

  // Write master file in project root
  File('static_data.json').writeAsStringSync(encoder.convert(allData));

  print('Successfully exported:');
  print(' - static_data.json (Master)');
  print(' - static_data/cities.json (${citiesJson.length} items)');
  print(' - static_data/sectors.json (${sectorsJson.length} items)');
  print(' - static_data/categories.json (${categoriesJson.length} items)');
  print(' - static_data/businesses.json (${businessesJson.length} items)');
  print(' - static_data/user_profile.json');
  print(' - static_data/notifications.json (${notificationsJson.length} items)');
  print(' - static_data/faqs.json (${faqsJson.length} items)');
}
