import random

array = [random.randint(0,10) for i in range(0,20)]

print(array)

result_count = {key : 0 for key in array}

for i in array:
    if i in result_count:
        result_count[i] += 1

print(result_count)
