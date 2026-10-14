# hokm-vision (نسخه‌ی JVM برای تست و ساخت قالب‌ها)
کامپایل: kotlinc Cards.kt HandMemory.kt Advisor.kt src/main/kotlin/hokm/vision/*.kt src/main/kotlin/hokm/game/*.kt tools/*.kt -include-runtime -d v.jar
- ساخت قالب: java -cp v.jar BuildTemplatesKt src/test/resources/fixtures src/test/resources/samples.txt src/main/resources/templates.txt
- ارزیابی (قالب‌ها بدون نمونه‌های همان عکس): java -cp v.jar VisionCheckKt src/test/resources/fixtures src/test/resources/samples.txt
- تست ردیاب: java -cp v.jar TrackerCheckKt
